import { ComplianceEngine } from '@/lib/compliance/engine';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Define allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://compliance.americanhm.com', // Add your production domain here
];

export async function POST(request: Request) {
  console.log('Starting compliance check...');
  try {
    // Get the origin from the request headers
    const headersList = await headers();
    const origin = headersList.get('origin') || '';

    // Check if the origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin);
    
    // Get the request body
    const body = await request.json();
    console.log('Request body:', body);
    const { phoneNumber } = body;
    
    if (!phoneNumber) {
      return new NextResponse(
        JSON.stringify({ error: 'Phone number is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
          },
        }
      );
    }

    const engine = new ComplianceEngine();
    console.log('Checking phone number:', phoneNumber);
    const report = await engine.checkPhoneNumber(phoneNumber);
    console.log('Check complete, report:', report);

    // Return the response with CORS headers if origin is allowed
    return new NextResponse(JSON.stringify(report), {
      headers: {
        'Content-Type': 'application/json',
        ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      },
    });
  } catch (error) {
    console.error('Error checking compliance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check compliance';
    return new NextResponse(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...(origin && allowedOrigins.includes(origin) && {
            'Access-Control-Allow-Origin': origin,
          }),
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: Request) {
  const headersList = await headers();
  const origin = headersList.get('origin') || '';

  // Check if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }

  return new NextResponse(null, { status: 204 });
}
