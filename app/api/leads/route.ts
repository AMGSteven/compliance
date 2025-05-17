import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !listId || !campaignId) {
      console.error('Missing required fields:', { firstName, lastName, email, phone, listId, campaignId });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          received: { firstName, lastName, email, phone, listId, campaignId },
          required: ['firstName', 'lastName', 'email', 'phone', 'listId', 'campaignId']
        },
        { status: 400 }
      );
    }

    console.log('Submitting standard lead with validated fields:', { firstName, lastName, email, phone });
    
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
          state: body.state || '',
          zip_code: zipCode || '',
          source: body.source || '',
          trusted_form_cert_url: trustedFormCertUrl || '',
          transaction_id: body.transactionId || body.transaction_id || '',
          custom_fields: body.customFields || body.custom_fields || null,
          list_id: listId,
          campaign_id: campaignId,
          traffic_source: trafficSource,
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

    return NextResponse.json({
      success: true,
      data: data[0]
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
    
    // Get data from nested objects with safety checks
    const contactData = body.ContactData || {};
    const person = body.Person || {};
    const conditions = person.Conditions || {};
    const medicalHistory = person.MedicalHistory || {};
    const requestedInsurance = body.RequestedInsurancePolicy || {};
    const currentInsurance = body.CurrentInsurancePolicy || {};
    
    // Extract basic lead data
    const firstName = contactData.FirstName || '';
    const lastName = contactData.LastName || '';
    const email = contactData.EmailAddress || '';
    const phone = contactData.PhoneNumber || '';
    
    console.log('Extracted contact data:', { firstName, lastName, email, phone });
    
    // For now, we'll skip strict validation to facilitate testing
    // In production, you might want to enforce validation
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Generate a list_id and campaign_id based on the data
    const listId = body.SubId || 'health-insurance-default';
    const campaignId = body.Vertical || 'health-insurance-campaign';
    
    // Determine traffic source
    let trafficSource = body.Source || '';
    if (!trafficSource) {
      if (body.SubId === 'OPG4') {
        trafficSource = 'Onpoint';
      }
    }
    
    // Parse birth date if available
    let birthDate = null;
    if (person.BirthDate) {
      try {
        birthDate = new Date(person.BirthDate).toISOString().split('T')[0];
      } catch (error) {
        console.warn('Failed to parse birth date:', person.BirthDate);
      }
    }
    
    // Check if database schema is ready
    try {
      const { error: schemaError } = await supabase.from('leads').select('api_token').limit(1);
      
      if (schemaError) {
        console.error('Migration might be needed - schema check failed:', schemaError.message);
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
          state: contactData.State || '',
          zip_code: contactData.ZipCode || '',
          
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
          birth_date: person.BirthDate ? new Date(person.BirthDate).toISOString().split('T')[0] : null,
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

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error processing health insurance lead submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process health insurance lead submission' },
      { status: 500 }
    );
  }
}
