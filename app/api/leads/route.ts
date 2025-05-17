import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received lead submission body:', body);
    
    // Support both camelCase and snake_case field names
    const firstName = body.firstName || body.first_name;
    const lastName = body.lastName || body.last_name;
    const email = body.email;
    const phone = body.phone;
    const zipCode = body.zipCode || body.zip_code;
    const trustedFormCertUrl = body.trustedFormCertUrl || body.trusted_form_cert_url;
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

    console.log('Submitting lead with validated fields:', { firstName, lastName, email, phone, zipCode, trustedFormCertUrl, listId, campaignId });
    
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
      console.error('Error inserting lead:', error);
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
