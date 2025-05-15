import { NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100
});

export async function GET(request: Request) {
  console.log('GET /api/dialer/dnc');
  try {
    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');
    if (!await validateApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Get phone number from query params
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');
    
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
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
    // Get API key from headers
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    const apiKey = request.headers.get('x-api-key');
    console.log('API Key:', apiKey);
    console.log('API Key:', apiKey, 'Configured keys:', process.env.DIALER_API_KEYS);

    if (!await validateApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    try {
      await limiter.check(5, apiKey!); // 5 requests per minute per API key
    } catch {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    console.log('Request body:', body);
    const { phone_number, reason, source } = body;
    const prisma = new PrismaClient();

    // Validate required fields
    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    console.log('Creating DNC entry...');
    const result = await prisma.dNCEntry.upsert({
      where: { phone_number },
      update: {
        reason: reason || 'Added by dialer system',
        source: 'dialer_system',
        added_by: 'dialer_auto',
        metadata: {
          campaign: 'unknown',
          agentId: 'dialer_auto',
          dialerTimestamp: new Date().toISOString()
        }
      },
      create: {
        phone_number,
        reason: reason || 'Added by dialer system',
        source: 'dialer_system',
        added_by: 'dialer_auto',
        metadata: {
          campaign: 'unknown',
          agentId: 'dialer_auto',
          dialerTimestamp: new Date().toISOString()
        }
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
