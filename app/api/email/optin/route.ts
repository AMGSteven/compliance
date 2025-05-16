import { NextRequest, NextResponse } from 'next/server';
import { EmailManager } from '@/lib/compliance/email-manager';

// Force dynamic to prevent build-time issues with Supabase
export const dynamic = 'force-dynamic';

// Helper function to validate an email address
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// GET endpoint to check if an email is on the opt-in list
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const apiKey = searchParams.get('api_key') || request.headers.get('x-api-key');

    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing API key' },
        { status: 401 }
      );
    }

    // Simple test key check for development
    const isTestKey = apiKey === 'test_key_123';
    const validApiKey = isTestKey || apiKey === process.env.API_KEY;

    if (!validApiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Validate email
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email is in opt-in list
    const emailManager = new EmailManager();
    const { isOptedIn, data, error } = await emailManager.checkOptIn(email);

    if (error) {
      console.error('Error checking email opt-in status:', error);
      return NextResponse.json(
        { success: false, error: 'Error checking email opt-in status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_opted_in: isOptedIn,
      data: isOptedIn ? data : null
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/email/optin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST endpoint to add an email to the opt-in list
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email, first_name, last_name, source, consent_details } = body;

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key') || body.api_key;

    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing API key' },
        { status: 401 }
      );
    }

    // Simple test key check for development
    const isTestKey = apiKey === 'test_key_123';
    const validApiKey = isTestKey || apiKey === process.env.API_KEY;

    if (!validApiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Validate email
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Add email to opt-in list
    const emailManager = new EmailManager();
    const result = await emailManager.addToOptIn({
      email,
      first_name,
      last_name,
      source: source || 'api',
      consent_details,
      added_by: 'api'
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Failed to add email to opt-in list' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email added to opt-in list successfully',
      data: result.data
    });
  } catch (error: any) {
    console.error('Unexpected error in POST /api/email/optin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
