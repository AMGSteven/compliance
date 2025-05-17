import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received lead submission body:', body);
    
    // Handle standard lead format
    if (body.firstName || body.first_name || body.FirstName) {
      return handleStandardLead(body, request);
    }
    // Handle health insurance lead format
    else if (body.ContactData && body.Person) {
      return handleHealthInsuranceLead(body, request);
    }
    else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unrecognized lead format'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing lead submission:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process lead submission' },
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
    
    // Validate minimal required fields
    if (!firstName || !lastName || !email || !phone) {
      console.error('Missing required fields in health insurance lead:', { firstName, lastName, email, phone });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields in health insurance lead',
          received: { firstName, lastName, email, phone },
          required: ['ContactData.FirstName', 'ContactData.LastName', 'ContactData.EmailAddress', 'ContactData.PhoneNumber']
        },
        { status: 400 }
      );
    }
    
    console.log('Submitting health insurance lead with validated fields:', { firstName, lastName, email, phone });
    
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
          list_id: listId,
          campaign_id: campaignId,
          traffic_source: trafficSource,
          
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
          birth_date: birthDate,
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
