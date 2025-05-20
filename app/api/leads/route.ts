import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ComplianceEngine } from '@/lib/compliance/engine';

// Main POST handler for all lead formats
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received lead submission body:', JSON.stringify(body).slice(0, 500) + '...');
    
    // Log keys to help with debugging
    const keys = Object.keys(body);
    console.log('Request body keys:', keys);
    
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
    const listId = body.listId || body.list_id;
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
    
    // Use the ComplianceEngine that includes all checkers: TCPA, Blacklist, Webrecon, and Internal DNC
    const complianceEngine = new ComplianceEngine();
    const complianceReport = await complianceEngine.checkPhoneNumber(phone);
    
    if (!complianceReport.isCompliant) {
      console.log('Phone number failed compliance check, rejecting lead:', phone);
      
      // Find the failed check(s) to provide more specific details
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      const failedSources = failedChecks.map(check => check.source).join(', ');
      const failedReasons = failedChecks.flatMap(check => check.reasons);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedChecks.map(check => check.source),
            reasons: failedReasons,
            phoneNumber: phone,
            complianceResults: complianceReport.results
          }
        },
        { status: 403 }
      );
    }
    
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
    let routingData = null;
    // Create mutable copies of the campaign and cadence IDs
    let effectiveCampaignId = campaignId;
    let effectiveCadenceId = cadenceId;
    
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
    } else {
      console.log('No routing found for list ID:', listId);
    }
    
    console.log('Final values used for dialer:', { effectiveCampaignId, effectiveCadenceId });

    // Check if this lead should be forwarded to the dialer API
    // Either for the original hardcoded list ID or if we have a routing configuration
    if (listId === 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e' || routingData) {
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
          lead_id: string; // Add lead_id to the interface
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
          custom_fields: body.customFields || body.custom_fields || {},
          
          // Include the routing IDs directly in the payload
          list_id: listId,
          campaign_id: effectiveCampaignId,
          cadence_id: effectiveCadenceId,
          
          // Include the lead ID to enable policy postback tracking
          lead_id: data[0].id
        };
        
        // The dialer API expects list_id and token as URL parameters, not just in the JSON payload
        // Use the provided token or fallback to the default one
        const authToken = token || '7f108eff2dbf3ab07d562174da6dbe53';
        
        // Construct the URL with required parameters in the query string
        const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
        dialerUrl.searchParams.append('list_id', listId);
        dialerUrl.searchParams.append('campaign_id', effectiveCampaignId);
        dialerUrl.searchParams.append('cadence_id', effectiveCadenceId);
        dialerUrl.searchParams.append('token', authToken);
        
        console.log('Sending lead to dialer API:', dialerUrl.toString());
        console.log('Dialer payload with lead_id:', JSON.stringify(dialerPayload, null, 2));
        console.log('Lead ID being sent to dialer:', dialerPayload.lead_id);
        
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
    
    // Check phone compliance for health insurance leads as well
    console.log('Performing compliance check for health insurance lead phone:', phone);
    const complianceEngine = new ComplianceEngine();
    const complianceReport = await complianceEngine.checkPhoneNumber(phone);
    
    if (!complianceReport.isCompliant) {
      console.log('Health insurance lead phone failed compliance check:', phone);
      
      // Find the failed check(s) to provide more specific details
      const failedChecks = complianceReport.results.filter(result => !result.isCompliant);
      const failedSources = failedChecks.map(check => check.source).join(', ');
      const failedReasons = failedChecks.flatMap(check => check.reasons);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Phone number failed compliance check with: ${failedSources}`, 
          details: {
            failedSources: failedChecks.map(check => check.source),
            reasons: failedReasons,
            phoneNumber: phone,
            complianceResults: complianceReport.results
          }
        },
        { status: 403 }
      );
    }
    
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
          residence_type: contactData.ResidenceType || '',
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
          house_hold_income: person.HouseHoldIncome || '',
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

    // Look up routing data to get the bid
    let bid = 0.00;
    const listId = body.SubId || 'health-insurance-default';
    
    // Try to get the bid from list_routings if a SubId is provided
    if (listId && listId !== 'health-insurance-default') {
      const { data: routingResults } = await supabase
        .from('list_routings')
        .select('bid')
        .eq('list_id', listId)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
        
        if (routingResults && routingResults.bid) {
          bid = routingResults.bid;
        }
      }

      // Include bid and lead_id in the response for successful submissions
      return NextResponse.json({
        success: true, 
        lead_id: data[0].id, // Explicitly return the lead ID
        data: data[0],
        bid: bid
      });
    } catch (error) {
      console.error('Error processing health insurance lead submission:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process health insurance lead submission' },
        { status: 500 }
      );
    }
  }
