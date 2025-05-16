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

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      console.error('Missing required fields:', { firstName, lastName, email, phone });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          received: { firstName, lastName, email, phone }
        },
        { status: 400 }
      );
    }

    console.log('Submitting lead with validated fields:', { firstName, lastName, email, phone, zipCode, trustedFormCertUrl });

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
          zip_code: zipCode || '',
          trusted_form_cert_url: trustedFormCertUrl || '',
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
