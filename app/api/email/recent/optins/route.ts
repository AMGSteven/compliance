import { NextRequest, NextResponse } from 'next/server';
import { EmailManager } from '@/lib/compliance/email-manager';

// Force dynamic to prevent build-time issues with Supabase
export const dynamic = 'force-dynamic';

// GET endpoint to fetch recent email opt-ins
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const apiKey = searchParams.get('api_key') || request.headers.get('x-api-key');

    // Convert parameters with defaults
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

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

    // Fetch recent opt-ins
    const emailManager = new EmailManager();
    const { data, error } = await emailManager.getRecentOptIns(limit, offset);

    if (error) {
      console.error('Error fetching recent email opt-ins:', error);
      return NextResponse.json(
        { success: false, error: 'Error fetching recent email opt-ins' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      data: data
    });
  } catch (error: any) {
    console.error('Unexpected error in GET /api/email/recent/optins:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
