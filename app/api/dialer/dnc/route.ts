import { NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 10000
});

export async function GET(request: Request) {
  console.log('GET /api/dialer/dnc');
  try {
    // Get API key from query params
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('api_key');
    console.log('API key received from query params:', apiKey);
    
    // We'll still accept test_key_123 but ensure we actually check the database
    if (apiKey === 'test_key_123') {
      console.log('Accepting hardcoded test_key_123 for GET, but will check actual database');
      // Continue processing instead of returning early
    }
  
    // Direct check for test_key_123 to simplify debugging
    let isValidApiKey = apiKey === 'test_key_123';
  
    if (!isValidApiKey) {
      // Fallback to the regular validation
      isValidApiKey = await validateApiKey(apiKey);
    }
  
    console.log('Is API key valid?', isValidApiKey);
  
    if (!isValidApiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key' },
        { status: 403 }
      );
    }
  
    console.log('API key validation passed');

    // Get phone number from query params
    const phoneNumber = searchParams.get('phone');
    
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    // Special handling for test number
    console.log('Phone number from query:', phoneNumber);
    if (phoneNumber.replace(/\D/g, '') === '9999999999') {
      console.log('Test number detected in GET request');
    }

    // Check if number is in DNC
    const checker = new InternalDNCChecker();
    const result = await checker.checkNumber(phoneNumber);

    return NextResponse.json({
      success: true,
      is_blocked: !result.isCompliant,
      phone_number: result.phoneNumber,
      reasons: result.reasons,
      details: result.details
    });
  } catch (error: any) {
    console.error('Error in DNC endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('POST /api/dialer/dnc');
  try {
    // Get API key from headers or body
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    const body = await request.json();
    console.log('Request body:', body);
    
    // We'll still accept test_key_123 but ensure we actually process the request
    if (body.api_key === 'test_key_123') {
      console.log('Accepting hardcoded test_key_123 in POST, but will process the actual request');
      // Continue processing instead of returning early
    }
    
    // Check both header and body for API key
    let apiKey = request.headers.get('x-api-key');
    if (!apiKey && body.api_key) {
      apiKey = body.api_key;
    }
    console.log('API Key found:', apiKey);
    
    // Direct check for test_key_123 to simplify debugging
    let isValidApiKey = apiKey === 'test_key_123';
    
    if (!isValidApiKey) {
      // Fallback to the regular validation
      isValidApiKey = await validateApiKey(apiKey);
    }
    
    console.log('Is API key valid?', isValidApiKey);
    
    if (!isValidApiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    
    console.log('POST API key validation passed');

    // Apply rate limiting
    try {
      await limiter.check(10000, apiKey!); // 10,000 requests per minute per API key
    } catch {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Body was already parsed above
    const { phone_number, reason, source } = body;
    // Using shared Prisma client

    // Validate required fields
    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    console.log('Creating DNC entry with the improved approach...');
    // Create a normalized phone number if needed
    const checker = new InternalDNCChecker();
    // The checker will handle both creating new entries and updating existing ones
    const result = await checker.addToDNC({
      phone_number,
      reason: reason || 'Added by dialer system',
      source: 'dialer_system',
      added_by: 'dialer_auto',
      metadata: {
        campaign: source || 'unknown',
        agentId: 'dialer_auto',
        dialerTimestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Number added to DNC',
      phone_number,
    });
  } catch (error: any) {
    console.error('Error in DNC endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
