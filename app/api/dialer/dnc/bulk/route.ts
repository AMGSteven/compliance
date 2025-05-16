import { NextResponse } from 'next/server';
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker';
import { rateLimit } from '@/lib/rate-limit';
import { validateApiKey } from '@/lib/auth';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 10000
});

export async function POST(request: Request) {
  try {
    // Check API key
    const apiKey = request.headers.get('x-dialer-api-key');
    if (!await validateApiKey(apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    try {
      await limiter.check(10000, apiKey!); // 10,000 requests per minute per API key
    } catch {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { numbers, reason, campaign } = body;

    // Validate required fields
    if (!numbers || !Array.isArray(numbers)) {
      return NextResponse.json(
        { success: false, error: 'numbers array is required' },
        { status: 400 }
      );
    }

    const checker = new InternalDNCChecker();
    const entries = numbers.map(number => ({
      phoneNumber: typeof number === 'string' ? number : number.phoneNumber,
      reason: number.reason || reason || 'Bulk add from dialer',
      source: 'dialer_system_bulk',
      addedBy: number.agentId || 'dialer_bulk',
      metadata: {
        campaign: campaign || 'bulk_import',
        importTimestamp: new Date().toISOString(),
        ...(typeof number === 'object' ? { agentId: number.agentId } : {})
      }
    }));

    const result = await checker.bulkAddToDNC(entries);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error in bulk DNC endpoint:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
