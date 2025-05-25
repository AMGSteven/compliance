import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ComplianceEngine } from '@/lib/compliance/engine';
import { checkPhoneCompliance } from '@/app/lib/real-phone-validation';

// Main POST handler for all lead formats
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received lead submission body:', JSON.stringify(body).slice(0, 500) + '...');
    
    // Log keys to help with debugging
    const keys = Object.keys(body);
    console.log('Request body keys:', keys);
    
    // Log the full request body for debugging - be careful with PII
    if (body.email === 'lray298915@gmail.com' || body.Email === 'lray298915@gmail.com' || 
        body.phone === '2106071548' || body.Phone === '2106071548' || 
        (body.ContactData && (body.ContactData.Email === 'lray298915@gmail.com' || body.ContactData.Phone === '2106071548'))) {
      console.log('IMPORTANT - Found Lindsay Ray lead:', JSON.stringify(body, null, 2));
    }
    
    // Test if this is the health insurance lead format
    if (keys.includes('ContactData') || keys.includes('ApiToken') || keys.includes('Vertical')) {
      console.log('Detected health insurance lead format');
      return await handleHealthInsuranceLead(body, request);
    }
    // This is the standard lead format
    else {
      console.log('Using standard lead format');
      return await handleStandardLead(body, request);
    }
  } catch (error) {
    console.error('Error processing lead submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process lead submission: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Handle standard lead format
async function handleStandardLead(body: any, request: Request) {
  try {
    // Support both camelCase and snake_case field names
    const firstName = body.firstName || body.first_name || body.FirstName;
    const lastName = body.lastName || body.last_name || body.LastName;
    const email = body.email || body.Email || body.EmailAddress;
    const phone = body.phone || body.Phone || body.PhoneNumber;
    const zipCode = body.zipCode || body.zip_code || body.ZipCode;
    const trustedFormCertUrl = body.trustedFormCertUrl || body.trusted_form_cert_url || body.TrustedForm;
    // Use 'let' instead of 'const' to allow correcting the list ID for special cases
    let listId = body.listId || body.list_id;
    const campaignId = body.campaignId || body.campaign_id;
    const cadenceId = body.cadenceId || body.cadence_id;
    const token = body.token || body.Token;
    
    // New required compliance fields
    const incomeBracket = body.incomeBracket || body.income_bracket || body.IncomeBracket;
    const ageRange = body.ageRange || body.age_range || body.AgeRange;
    const dob = body.dob || body.dateOfBirth || body.date_of_birth || body.DateOfBirth || body.birthDate || body.birth_date || body.BirthDate;
    const homeownerStatus = body.homeownerStatus || body.homeowner_status || body.HomeownerStatus || body.residenceType || body.residence_type;
    const state = body.state || body.State;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !listId || !campaignId || 
        !incomeBracket || !state || !homeownerStatus || !(ageRange || dob)) {
      console.error('Missing required fields:', { 
        firstName, lastName, email, phone, listId, campaignId,
        incomeBracket, state, homeownerStatus, ageRange, dob 
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          received: { 
            firstName, lastName, email, phone, listId, campaignId,
            incomeBracket, state, homeownerStatus, ageRange, dob 
          },
          required: [
            'firstName', 'lastName', 'email', 'phone', 'listId', 'campaignId',
            'incomeBracket', 'state', 'homeownerStatus', 'ageRange or dob'
          ]
        },
        { status: 400 }
      );
    }

    console.log('Submitting standard lead with validated fields:', { firstName, lastName, email, phone });

    // Perform comprehensive compliance check across all sources - using the same engine as the /compliance page
    console.log('Performing comprehensive compliance check for phone:', phone);
    
    // 1. Check using the five DNC sources (TCPA, Blacklist, WebRecon, Internal DNC, Synergy DNC)
    const complianceEngine = new ComplianceEngine();
    const complianceReport = await complianceEngine.checkPhoneNumber(phone);
    
    // 2. Check using RealPhoneValidation API for phone service status
    console.log('Performing phone validation check for:', phone);
    const phoneValidationResult = await checkPhoneCompliance(phone);
    
    // Combined compliance result from both DNC checks and phone validation
    const isCompliant = complianceReport.isCompliant && phoneValidationResult.isCompliant;
    
    if (!isCompliant) {
      // Gather failed sources from DNC checkers
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      let failedSources = failedChecks.map(check => check.source);
      let failedReasons = failedChecks.flatMap(check => check.reasons);
      
      // Add phone validation failure if applicable
      if (!phoneValidationResult.isCompliant) {
        failedSources.push('Phone Validation');
        failedReasons.push(phoneValidationResult.reason || 'Failed phone validation');
      }
      
      const failedSourcesStr = failedSources.join(', ');
      console.log('Phone number failed compliance check, rejecting lead with $0 bid:', phone);
      
      return NextResponse.json(
        { 
          success: false, 
          bid: 0.00, // Force $0 bid for non-compliant leads regardless of routing
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedSources,
            reasons: failedReasons,
            phoneNumber: phone,
            phoneValidation: phoneValidationResult,
            complianceResults: complianceReport.results
          }
        },
        { status: 400 }
      );
    }
    
    // If the lead passes compliance checks, use the normal bid from routing
    let bidValue = 0.00; // Default bid value - will be updated from list routing later
    let routingData: any = null; // Will store routing data if found
    let effectiveCampaignId = campaignId; // Default is the one passed in the request
    let effectiveCadenceId = cadenceId; // Default is the one passed in the request
    
    // Determine traffic source based on list_id
    let trafficSource = body.trafficSource || body.traffic_source;
    
    // If no traffic_source is provided, set it based on list_id mapping
    if (!trafficSource) {
      if (listId === '1b759535-2a5e-421e-9371-3bde7f855c60') {
        trafficSource = 'Onpoint';
      } else if (listId === 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e') {
        trafficSource = 'Juiced';
      }
    }

    console.log('Using traffic source:', trafficSource);

    // Create Supabase client
    const supabase = createServerClient();

    // Insert lead into the database
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          address: body.address || '',
          city: body.city || '',
          state: state,
          zip_code: zipCode || '',
          source: body.source || '',
          bid: bidValue, // Store the bid value from list routing at time of creation
          trusted_form_cert_url: trustedFormCertUrl || '',
          transaction_id: body.transactionId || body.transaction_id || '',
          custom_fields: body.customFields || body.custom_fields || null,
          list_id: listId,
          campaign_id: campaignId,
          traffic_source: trafficSource,
          cadence_id: cadenceId || null,
          token: token || null,
          income_bracket: incomeBracket,
          age_range: ageRange || '',
          birth_date: dob ? new Date(dob).toISOString().split('T')[0] : null,
          homeowner_status: homeownerStatus,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Failed to insert standard lead:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to insert lead' },
        { status: 500 }
      );
    }

    console.log('Lead inserted successfully:', data);
    
    // Look up campaign and cadence IDs from the routings table
    console.log('Looking up routing data for list ID:', listId);
    
    // Handle Onpoint leads with fuzzy list ID matching
    // This handles cases where minor variations in the Onpoint list ID are sent
    const correctOnpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
    
    // Check if this is an Onpoint lead based on list ID pattern or source
    const isOnpointListId = (
      listId === correctOnpointListId || 
      (listId && listId.length > 30 && (
        listId.includes('759') && 
        listId.includes('3bde7f8') && 
        listId.includes('421e-9371')
      ))
    );
    
    const isOnpointSource = (
      body.source?.toLowerCase()?.includes('onpoint') || 
      body.Source?.toLowerCase()?.includes('onpoint')
    );
    
    if (isOnpointListId || isOnpointSource) {
      console.log('IMPORTANT - Detected Onpoint lead with listId:', listId);
      console.log('Onpoint lead campaign ID:', campaignId);
      console.log('Onpoint lead cadence ID:', cadenceId);
      
      // Correct the list ID for Onpoint leads to ensure they're properly processed
      if (listId !== correctOnpointListId) {
        console.log(`Correcting Onpoint list ID from ${listId} to ${correctOnpointListId}`);
        listId = correctOnpointListId;
      }
    }
    
    // Variables were already declared earlier
    // Just set their initial values here
    routingData = null;
    effectiveCampaignId = campaignId || '';
    effectiveCadenceId = cadenceId || '';
    
    console.log('Initial values:', { campaignId, cadenceId });
    
    // Query list_routings to get routing data including the bid
    const { data: routingResults, error: routingError } = await supabase
      .from('list_routings')
      .select('*')
      .eq('list_id', listId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
      
    if (routingError) {
      console.error('Error looking up list routing:', routingError);
    }
    
    console.log('Routing results:', routingResults);
      
    // Get the bid value to store with the lead
    
    if (routingResults) {
      routingData = routingResults;
      console.log(`Found list routing for ${listId}:`, routingData);
      
      // Get the bid value from routing data
      if (routingData.bid) {
        bidValue = routingData.bid;
        console.log(`Using bid value from list routing: $${bidValue.toFixed(2)}`);
      }
      
      // Override campaign_id and cadence_id if provided in the routing
      if (routingData.campaign_id) {
        console.log(`Overriding campaign_id from ${effectiveCampaignId} to ${routingData.campaign_id}`);
        effectiveCampaignId = routingData.campaign_id;
      }
      
      if (routingData.cadence_id) {
        console.log(`Overriding cadence_id from ${effectiveCadenceId} to ${routingData.cadence_id}`);
        effectiveCadenceId = routingData.cadence_id;
      }
    } else {
      console.log('No routing found for list ID:', listId);
      
      // Set default bid values based on known list IDs if no routing found
      if (listId === '1b759535-2a5e-421e-9371-3bde7f855c60' || isOnpointListId || isOnpointSource) {
        bidValue = 0.50; // Default for Onpoint
        console.log('Using default bid value for Onpoint: $0.50');
      } else if (listId === 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e') {
        bidValue = 1.00; // Default for Juiced
        console.log('Using default bid value for Juiced: $1.00');
      }
    }
    
    console.log('Final values used for dialer:', { effectiveCampaignId, effectiveCadenceId });

    // Check if this lead should be forwarded to the dialer API
    // Any list ID in the routing settings will have routingData and be eligible for forwarding
    if (routingData) {
      // Load balancing for Onpoint leads - split between two cadence IDs
      const isOnpointLead = listId === '1b759535-2a5e-421e-9371-3bde7f855c60';
      
      if (isOnpointLead) {
        // Use phone number or email as a deterministic way to split leads
        // This ensures the same lead always goes to the same cadence
        const hashSource = phone || email || '';
        const useFirstCadence = hashSource.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0) % 2 === 0;
        
        const onpointCadenceOptions = [
          'd669792b-2b43-4c8e-bb9d-d19e5420de63', // First cadence (50%)
          '39a9381e-14ef-4fdd-a95a-9649025590a4'  // Second cadence (50%)
        ];
        
        const selectedCadence = useFirstCadence ? onpointCadenceOptions[0] : onpointCadenceOptions[1];
        console.log(`Onpoint lead detected - load balancing to cadence: ${selectedCadence} (${useFirstCadence ? 'first' : 'second'} group)`);
        
        // Override the cadence ID for Onpoint leads
        effectiveCadenceId = selectedCadence;
      }
      
      try {
        console.log('Forwarding lead to dialer API for list:', listId);
        
        // Prepare the lead data for dialer API - follow exact format expected by dialer
        // Format phone number with +1 prefix if it doesn't have it already
        const formattedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;
        
        // Define the type for dialer payload to avoid TypeScript errors
        interface DialerPayload {
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          address: string;
          city: string;
          state: string;
          zip_code: string;
          source: string;
          trusted_form_cert_url: string;
          transaction_id: string;
          income_bracket: string;
          dob: string;
          homeowner_status: string;
          custom_fields: Record<string, any>;
          list_id: string;
          campaign_id: string;
          cadence_id: string | null;
          compliance_lead_id: string; // Add compliance_lead_id to the interface
        };
        
        // Create the dialer payload with all required fields
        const dialerPayload: DialerPayload = {
          // Primary lead fields
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: formattedPhone,
          address: body.address || '',
          city: body.city || '',
          state: state || '',
          zip_code: zipCode || '',
          source: body.source || 'Compliance API',
          trusted_form_cert_url: trustedFormCertUrl || '',
          transaction_id: body.transactionId || body.transaction_id || '',
          
          // Important compliance and demographic fields
          income_bracket: incomeBracket,
          dob: dob || '',
          homeowner_status: homeownerStatus,
          
          // Custom fields passed through as a nested object
          custom_fields: {
            ...(body.customFields || body.custom_fields || {}),
            compliance_lead_id: data[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: data[0].id
        };
        
        // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
        // Use the routing token if available, then the provided token, then fallback to a default
        let authToken = '';
        
        if (routingData && routingData.token) {
          console.log(`Using token from routing settings: ${routingData.token}`);
          authToken = routingData.token;
        } else if (token) {
          console.log(`Using token from request: ${token}`);
          authToken = token;
        } else {
          console.log('No token available, using default token');
          authToken = '7f108eff2dbf3ab07d562174da6dbe53';
        }
        
        // Construct the URL with required parameters in the query string
        const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
        dialerUrl.searchParams.append('list_id', listId);
        dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
        dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
        dialerUrl.searchParams.append('token', authToken);
        
        console.log('Sending lead to dialer API:', dialerUrl.toString());
        console.log('Dialer payload with compliance_lead_id:', JSON.stringify(dialerPayload, null, 2));
        console.log('Lead ID being sent to dialer:', dialerPayload.compliance_lead_id);
        
        // Send the lead to the dialer API
        const dialerResponse = await fetch(dialerUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dialerPayload)
        });
        
        const dialerResult = await dialerResponse.json();
        console.log('Dialer API response:', dialerResult);
        
        // Include the dialer response in our API response
        // Include bid information for successful lead submission
        return NextResponse.json({ 
          success: true, 
          lead_id: data[0].id, // Explicitly return the lead ID
          data: data[0],
          bid: routingData?.bid || 0.00,
          dialer: {
            forwarded: true,
            response: dialerResult
          }
        });
      } catch (dialerError) {
        console.error('Error forwarding lead to dialer:', dialerError);
        // Still return success for the lead insertion, but include the dialer error
        // Include bid information for successful lead submission even when dialer fails
        return NextResponse.json({ 
          success: true, 
          lead_id: data[0].id, // Explicitly return the lead ID
          data: data[0],
          bid: routingData?.bid || 0.00,
          dialer: {
            forwarded: false,
            error: dialerError instanceof Error ? dialerError.message : 'Unknown error'
          }
        });
      }
    }
    
    // Include bid in the response for successful submissions
    return NextResponse.json({
      success: true, 
      lead_id: data[0].id, // Explicitly return the lead ID
      data: data[0],
      bid: routingData?.bid || 0.00
    });
  } catch (error: any) {
    console.error('Error in leads API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An error occurred' },
      { status: 500 }
    );
  }
}

// Handle health insurance lead format
async function handleHealthInsuranceLead(body: any, request: Request) {
  try {
    console.log('Processing health insurance lead...');
    
    // Create the contact data for health insurance lead
    const contactData = body.ContactData || {};
    const person = body.Person || {};
    const conditions = body.Conditions || {};
    const medicalHistory = body.MedicalHistory || {};
    const requestedInsurance = body.RequestedInsurance || {};
    const currentInsurance = body.CurrentInsurance || {};
    
    // Extract cadence_id and token if provided
    const cadenceId = body.CadenceID || body.cadenceId || body.cadence_id || null;
    const token = body.Token || body.token || null;
    
    // Extract lead demographic info
    const firstName = contactData.FirstName || '';
    const lastName = contactData.LastName || '';
    const email = contactData.Email || '';
    const phone = contactData.Phone || '';
    const state = contactData.State || '';
    
    // Compliance fields - extract from various potential locations
    const incomeBracket = person.HouseHoldIncome || '50000-75000';  // Default value
    const ageRange = '';  // Derive from DOB if needed
    const dob = person.DOB || '';
    const homeownerStatus = contactData.ResidenceType || 'Not Provided';
    
    // Validate required fields for health insurance lead
    if (!firstName || !lastName || !email || !phone || !state) {
      console.error('Missing required fields for health insurance lead:', {
        firstName, lastName, email, phone, state
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields for health insurance lead',
          received: {
            firstName, lastName, email, phone, state
          },
          required: ['firstName', 'lastName', 'email', 'phone', 'state']
        },
        { status: 400 }
      );
    }
    
    // Perform comprehensive compliance check for health insurance lead phone
    console.log('Performing compliance check for health insurance lead phone:', phone);
    
    // 1. Check using the five DNC sources (TCPA, Blacklist, WebRecon, Internal DNC, Synergy DNC)
    const engine = new ComplianceEngine();
    const complianceReport = await engine.checkPhoneNumber(phone);
    
    // 2. Check using RealPhoneValidation API for phone service status
    console.log('Performing phone validation check for:', phone);
    const phoneValidationResult = await checkPhoneCompliance(phone);
    
    // Combined compliance result from both DNC checks and phone validation
    const isCompliant = complianceReport.isCompliant && phoneValidationResult.isCompliant;
    
    if (!isCompliant) {
      // Gather failed sources from DNC checkers
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      let failedSources = failedChecks.map(check => check.source);
      let failedReasons = failedChecks.flatMap(check => check.reasons);
      
      // Add phone validation failure if applicable
      if (!phoneValidationResult.isCompliant) {
        failedSources.push('Phone Validation');
        failedReasons.push(phoneValidationResult.reason || 'Failed phone validation');
      }
      
      const failedSourcesStr = failedSources.join(', ');
      console.log('Health insurance lead phone failed compliance check:', phone);
      
      return NextResponse.json(
        { 
          success: false,
          bid: 0.00, // Force $0 bid for non-compliant leads regardless of routing
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedSources,
            reasons: failedReasons,
            phoneNumber: phone,
            phoneValidation: phoneValidationResult,
            complianceResults: complianceReport.results
          }
        },
        { status: 400 }
      );
    }
    
    // If the lead passes compliance checks, use the normal bid from routing
    
    // Create Supabase client
    const supabase = createServerClient();

    // Check if the schema has the necessary fields for health insurance leads
    try {
      // Check if the leads table has been updated with health insurance fields
      const { data: tableInfo, error: tableError } = await supabase
        .from('leads')
        .select('vertical')
        .limit(1);
        
      if (tableError) {
        console.error('Failed to check schema:', tableError);
        return NextResponse.json(
          { success: false, error: 'Database schema not ready for health insurance leads. Run the migration first.' },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('Failed to check schema:', err);
    }
    
    // Insert health insurance lead into the database
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          // Basic lead info
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          trusted_form_cert_url: body.TrustedForm || '',
          list_id: body.SubId || 'health-insurance-default',
          campaign_id: body.Vertical || 'health-insurance-campaign',
          traffic_source: body.Source || (body.SubId === 'OPG4' ? 'Onpoint' : ''),
          
          // Address details
          address: contactData.Address || '',
          city: contactData.City || '',
          state: state,
          zip_code: contactData.ZipCode || '',
          
          // Compliance fields
          income_bracket: incomeBracket,
          age_range: ageRange || '',
          homeowner_status: homeownerStatus,
          
          // API details
          api_token: body.ApiToken || '',
          vertical: body.Vertical || '',
          sub_id: body.SubId || '',
          user_agent: body.UserAgent || '',
          original_url: body.OriginalUrl || '',
          jornaya_lead_id: body.JornayaLeadId || '',
          session_length: body.SessionLength || '',
          tcpa_text: body.TcpaText || '',
          verify_address: body.VerifyAddress === 'true',
          original_creation_date: body.OriginalCreationDate ? new Date(body.OriginalCreationDate).toISOString() : null,
          site_license_number: body.SiteLicenseNumber || '',
          ip_address: contactData.IpAddress || '',
          
          // Contact details
          day_phone_number: contactData.DayPhoneNumber || '',

          years_at_residence: contactData.YearsAtResidence || '',
          months_at_residence: contactData.MonthsAtResidence || '',
          
          // Person details
          birth_date: dob ? new Date(dob).toISOString().split('T')[0] : null,
          gender: person.Gender || '',
          marital_status: person.MaritalStatus || '',
          relationship_to_applicant: person.RelationshipToApplicant || '',
          denied_insurance: person.DeniedInsurance || '',
          us_residence: person.USResidence === 'True',
          height_ft: person.Height_FT || '',
          height_inch: person.Height_Inch || '',
          weight: person.Weight || '',
          student: person.Student === 'true',
          occupation: person.Occupation || '',
          education: person.Education || '',
          house_hold_size: person.HouseHoldSize || '',
          
          // Medical information (as JSON)
          conditions: conditions,
          medical_history: medicalHistory,
          
          // Insurance information
          coverage_type: requestedInsurance.CoverageType || '',
          insurance_company: currentInsurance.InsuranceCompany || '',
          
          cadence_id: cadenceId,
          token: token,
          
          created_at: new Date().toISOString(),
          source: body.Source || ''
        }
      ])
      .select();
      
    if (error) {
      console.error('Failed to insert health insurance lead:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to insert health insurance lead' },
        { status: 500 }
      );
    }

    // Look up campaign and cadence IDs from the routings table
    let listId = body.SubId || 'health-insurance-default';
    console.log('Looking up routing data for list ID:', listId);
    
    // Handle Onpoint leads with fuzzy list ID matching in health insurance leads
    const correctOnpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
    
    // Check if this is an Onpoint lead based on list ID pattern
    const isOnpointListId = (
      listId === correctOnpointListId || 
      (listId && listId.length > 30 && (
        listId.includes('759') && 
        listId.includes('3bde7f8') && 
        listId.includes('421e-9371')
      ))
    );
    
    if (isOnpointListId || body.source?.toLowerCase()?.includes('onpoint')) {
      console.log('IMPORTANT - Detected Onpoint health insurance lead with listId:', listId);
      
      // Correct the list ID for Onpoint leads
      if (listId !== correctOnpointListId) {
        console.log(`Correcting Onpoint list ID from ${listId} to ${correctOnpointListId}`);
        listId = correctOnpointListId;
      }
    }
    
    let routingData = null;
    // Create mutable copies of the campaign and cadence IDs
    let effectiveCampaignId = body.Vertical || '';
    let effectiveCadenceId = body.CadenceID || body.cadenceId || body.cadence_id || null;
    let bid = 0.00;
    
    console.log('Initial values:', { campaignId: effectiveCampaignId, cadenceId: effectiveCadenceId });
    
    // Normalize the list ID to ensure consistent matching
    const normalizedListId = listId.trim().toLowerCase();
    
    // Query list_routings to get routing data including the bid
    const { data: routingResults, error: routingError } = await supabase
      .from('list_routings')
      .select('*')
      .eq('list_id', listId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
      
    if (routingError) {
      console.error('Error looking up list routing:', routingError);
    }
    
    console.log('Routing results:', routingResults);
      
    if (routingResults) {
      routingData = routingResults;
      console.log(`Found list routing for ${listId}:`, routingData);
      
      // Override campaign_id and cadence_id if provided in the routing
      if (routingData.campaign_id) {
        console.log(`Overriding campaign_id from ${effectiveCampaignId} to ${routingData.campaign_id}`);
        effectiveCampaignId = routingData.campaign_id;
      }
      
      if (routingData.cadence_id) {
        console.log(`Overriding cadence_id from ${effectiveCadenceId} to ${routingData.cadence_id}`);
        effectiveCadenceId = routingData.cadence_id;
      }
      
      if (routingData.bid) {
        bid = routingData.bid;
      }
    } else {
      console.log('No routing found for list ID:', listId);
    }
    
    console.log('Final values used for dialer:', { effectiveCampaignId, effectiveCadenceId });

    // Check if this lead should be forwarded to the dialer API based on routing configuration
    let dialerResponse = null;
    if (routingData) {
      // Load balancing for Onpoint leads - split between two cadence IDs
      const isOnpointLead = listId === '1b759535-2a5e-421e-9371-3bde7f855c60';
      
      if (isOnpointLead) {
        // Use phone number or email as a deterministic way to split leads
        // This ensures the same lead always goes to the same cadence
        const hashSource = contactData.Phone || contactData.Email || '';
        const useFirstCadence = hashSource.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0) % 2 === 0;
        
        const onpointCadenceOptions = [
          'd669792b-2b43-4c8e-bb9d-d19e5420de63', // First cadence (50%)
          '39a9381e-14ef-4fdd-a95a-9649025590a4'  // Second cadence (50%)
        ];
        
        const selectedCadence = useFirstCadence ? onpointCadenceOptions[0] : onpointCadenceOptions[1];
        console.log(`Onpoint health insurance lead detected - load balancing to cadence: ${selectedCadence} (${useFirstCadence ? 'first' : 'second'} group)`);
        
        // Override the cadence ID for Onpoint leads
        effectiveCadenceId = selectedCadence;
      }
      
      try {
        console.log('Forwarding health insurance lead to dialer API for list:', listId);
        
        // Format phone number with +1 prefix if it doesn't have it already
        const formattedPhone = phone.startsWith('+1') ? phone : `+1${phone.replace(/\D/g, '')}`;        
        
        // Define the type for dialer payload to avoid TypeScript errors
        interface DialerPayload {
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          address: string;
          city: string;
          state: string;
          zip_code: string;
          source: string;
          trusted_form_cert_url: string;
          transaction_id: string;
          income_bracket: string;
          dob: string;
          homeowner_status: string;
          custom_fields: Record<string, any>;
          list_id: string;
          campaign_id: string;
          cadence_id: string | null;
          compliance_lead_id: string; // Add compliance_lead_id to the interface
        };
        
        // Create the dialer payload with all required fields
        const dialerPayload: DialerPayload = {
          // Primary lead fields
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: formattedPhone,
          address: contactData.Address || '',
          city: contactData.City || '',
          state: state || '',
          zip_code: contactData.ZipCode || '',
          source: 'Health Insurance API',
          trusted_form_cert_url: body.TrustedForm || '',
          transaction_id: '',
          
          // Important compliance and demographic fields
          income_bracket: incomeBracket,
          dob: dob || '',
          homeowner_status: homeownerStatus,
          
          // Custom fields passed through as a nested object
          custom_fields: {
            compliance_lead_id: data[0].id // Add compliance_lead_id to custom fields
          },
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          compliance_lead_id: data[0].id
        };
        
        // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
        // Use the routing token if available, then the provided token, then fallback to a default
        let authToken = '';
        
        if (routingData && routingData.token) {
          console.log(`Using token from routing settings: ${routingData.token}`);
          authToken = routingData.token;
        } else if (body.ApiToken) {
          console.log(`Using token from request: ${body.ApiToken}`);
          authToken = body.ApiToken;
        } else {
          console.log('No token available, using default token');
          authToken = '7f108eff2dbf3ab07d562174da6dbe53';
        }
        
        // Construct the URL with required parameters in the query string
        const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
        dialerUrl.searchParams.append('list_id', listId);
        dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
        dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
        dialerUrl.searchParams.append('token', authToken);
        
        console.log('Sending health insurance lead to dialer API:', dialerUrl.toString());
        console.log('Dialer payload with compliance_lead_id:', JSON.stringify(dialerPayload, null, 2));
        console.log('Lead ID being sent to dialer:', dialerPayload.compliance_lead_id);
        
        // Send the lead to the dialer API
        const response = await fetch(dialerUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dialerPayload)
        });
        
        dialerResponse = await response.json();
        console.log('Dialer API response:', dialerResponse);
        
      } catch (dialerError: any) {
        console.error('Error forwarding health insurance lead to dialer:', dialerError);
        dialerResponse = { error: dialerError?.message || 'Unknown error' };
      }
    }

    // Include bid, lead_id, and dialer response in the API response
    const responseObj: any = {
      success: true, 
      lead_id: data[0].id, // Explicitly return the lead ID
      data: data[0],
      bid: bid
    };
    
    if (dialerResponse) {
      responseObj.dialer = {
        forwarded: true,
        response: dialerResponse
      };
    }
    
    return NextResponse.json(responseObj);
    } catch (error) {
      console.error('Error processing health insurance lead submission:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process health insurance lead submission' },
        { status: 500 }
      );
    }
  }
