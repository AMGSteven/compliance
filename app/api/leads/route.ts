import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';



// Validation schema for the lead data
const leadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  zipCode: z.string().min(5, "Zip code must be at least 5 digits"),
  trustedFormCertUrl: z.string().url("Invalid TrustedForm certificate URL")
});

export async function POST(request: Request) {
  console.log('Received lead submission request');

  try {
    const body = await request.json();
    console.log('Request body:', body);

    
    // Validate the request body
    const validatedData = leadSchema.parse(body);
    console.log('Validated data:', validatedData);


    // Store the lead in the database
    console.log('Creating lead in database...');
    const lead = await prisma.leads.create({
      data: {
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        email: validatedData.email,
        phone: validatedData.phone,
        zip_code: validatedData.zipCode,
        trusted_form_cert_url: validatedData.trustedFormCertUrl,
        status: 'new',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error('Error processing lead:', error instanceof Error ? error.message : error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
