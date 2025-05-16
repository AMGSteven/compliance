import { NextRequest, NextResponse } from 'next/server';
import { EmailManager } from '@/lib/compliance/email-manager';
import { EmailTableCreator } from '@/lib/compliance/email-table-creator';

// Force dynamic to prevent build-time issues with Supabase
export const dynamic = 'force-dynamic';

// Helper function to validate an email address
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// GET endpoint to check if an email is on the opt-out list
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

    // Check if email is in opt-out list
    const emailManager = new EmailManager();
    const { isOptedOut, data, error } = await emailManager.checkOptOut(email);

    if (error) {
      console.error('Error checking email opt-out status:', error);
      return NextResponse.json(
        { success: false, error: 'Error checking email opt-out status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_opted_out: isOptedOut,
      data: isOptedOut ? data : null
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/email/optout:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST endpoint to add an email to the opt-out list
export async function POST(request: NextRequest) {
  try {
    // Check if tables exist first
    const tableCreator = new EmailTableCreator();
    const tablesStatus = await tableCreator.initializeTables();
    
    if (!tablesStatus.success) {
      console.error('Email tables not ready:', tablesStatus.message);
      return NextResponse.json(
        { success: false, error: tablesStatus.message },
        { status: 500 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { email, first_name, last_name, reason, source } = body;

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

    // Add email to opt-out list
    const emailManager = new EmailManager();
    try {
      console.log('Attempting to add email to opt-out list:', { email, first_name, last_name });
      
      const result = await emailManager.addToOptOut({
        email,
        first_name,
        last_name,
        reason,
        source: source || 'api',
        added_by: 'api'
      });

      console.log('Result from addToOptOut:', result);
      
      if (!result.success) {
        console.error('Failed to add email to opt-out list:', result.error);
        return NextResponse.json(
          { success: false, error: result.message || 'Failed to add email to opt-out list', details: result.error },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('Unexpected error in emailManager.addToOptOut:', err);
      return NextResponse.json(
        { success: false, error: 'Unexpected error adding email to opt-out list', details: err },
        { status: 500 }
      );
    }

    // After successfully adding to opt-out list, return success
    // Note: We don't return the result of checkOptOut to avoid circular dependencies
    return NextResponse.json({
      success: true,
      message: 'Email added to opt-out list successfully'
    });
  } catch (error: any) {
    console.error('Unexpected error in POST /api/email/optout:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
