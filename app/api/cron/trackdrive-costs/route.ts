import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shared secret between Edge Function and this API route
const INTERNAL_TRIGGER_SECRET = process.env.INTERNAL_TRIGGER_SECRET;

/**
 * Cron job endpoint to automatically record Trackdrive costs
 * This should be called every hour to track spending accurately
 */
export async function POST(req: NextRequest) {
  const startTime = new Date();
  console.log(`\n🔄 [TRACKDRIVE-CRON] ======= CRON JOB STARTED at ${startTime.toISOString()} =======`);
  
  try {
    const body = await req.json();
    console.log('[TRACKDRIVE-CRON] Request body received:', body);
  } catch (e) {
    console.log('[TRACKDRIVE-CRON] No request body or invalid JSON - this is normal for cron jobs');
  }

  // 1. Security Check - Handle both Vercel cron and internal triggers
  const incomingSecret = req.headers.get('X-Internal-Trigger-Secret');
  const authHeader = req.headers.get('Authorization');
  const vercelCronSecret = process.env.CRON_SECRET;
  const internalTriggerSecret = process.env.INTERNAL_TRIGGER_SECRET;
  
  console.log('[TRACKDRIVE-CRON] Environment check:', {
    vercelCronSecret: vercelCronSecret ? 'SET' : 'MISSING',
    internalTriggerSecret: internalTriggerSecret ? 'SET' : 'MISSING',
    trackdriveApiKey: process.env.TRACKDRIVE_API_KEY ? 'SET' : 'MISSING',
    authHeaderPresent: authHeader ? 'YES' : 'NO',
    internalSecretPresent: incomingSecret ? 'YES' : 'NO'
  });
  
  // Check if it's a Vercel cron request
  const isVercelCron = authHeader === `Bearer ${vercelCronSecret}`;
  const isInternalTrigger = incomingSecret === internalTriggerSecret;
  
  console.log('[TRACKDRIVE-CRON] Authentication check:', {
    isVercelCron,
    isInternalTrigger,
    authMatches: authHeader === `Bearer ${vercelCronSecret}`,
    secretMatches: incomingSecret === internalTriggerSecret
  });
  
  if (!isVercelCron && !isInternalTrigger) {
    console.log('❌ [TRACKDRIVE-CRON] UNAUTHORIZED: Invalid authentication');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unauthorized - invalid cron secret or internal trigger',
        timestamp: startTime.toISOString()
      },
      { status: 401 }
    );
  }

  // 2. Environment Variable Check
  const trackdriveApiKey = process.env.TRACKDRIVE_API_KEY;
  if (!trackdriveApiKey) {
    console.error('❌ [TRACKDRIVE-CRON] MISSING TRACKDRIVE_API_KEY environment variable');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing TRACKDRIVE_API_KEY environment variable',
        timestamp: startTime.toISOString()
      },
      { status: 500 }
    );
  }

  // 3. Initialize Supabase Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ [TRACKDRIVE-CRON] Missing Supabase environment variables');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing Supabase configuration',
        timestamp: startTime.toISOString()
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 4. Calculate Time Window (1 hour before current time to current time)
    const now = new Date();
    const fromTime = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour before
    const toTime = now; // Current time
    
    console.log('🕐 [TRACKDRIVE-CRON] Time window:', {
      from: fromTime.toISOString(),
      to: toTime.toISOString(),
      periodHours: 1
    });

    // 5. Format dates for Trackdrive API (following their expected format)
    const formatTrackdriveDate = (date: Date): string => {
      // Format: 2025-08-06 09:59:59 -0500
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      // Use EST timezone offset (-0500)
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} -0500`;
    };

    // 6. Build Trackdrive API URL
    const baseUrl = 'https://synergy-marketplace.trackdrive.com/api/v1/charge_rollups';
    const params = new URLSearchParams({
      'filterModel[offer_id][type]': 'equals',
      'filterModel[offer_id][values][]': 'ACABA',
      'filterModel[offer_id][filterType]': 'set',
      'created_at_from': formatTrackdriveDate(fromTime),
      'created_at_to': formatTrackdriveDate(toTime)
    });
    
    const trackdriveUrl = `${baseUrl}?${params.toString()}`;
    console.log('🌐 [TRACKDRIVE-CRON] API URL:', trackdriveUrl);

    // 7. Call Trackdrive API
    console.log('📞 [TRACKDRIVE-CRON] Calling Trackdrive API...');
    const trackdriveResponse = await fetch(trackdriveUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${trackdriveApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Compliance-System/1.0'
      }
    });

    if (!trackdriveResponse.ok) {
      console.error('❌ [TRACKDRIVE-CRON] Trackdrive API error:', {
        status: trackdriveResponse.status,
        statusText: trackdriveResponse.statusText
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Trackdrive API error: ${trackdriveResponse.status} ${trackdriveResponse.statusText}`,
          timestamp: startTime.toISOString()
        },
        { status: 500 }
      );
    }

    const trackdriveData = await trackdriveResponse.json();
    console.log('📊 [TRACKDRIVE-CRON] Trackdrive API response:', {
      hasData: !!trackdriveData,
      hasTotals: !!trackdriveData.totals,
      totalsAmount: trackdriveData.totals?.amount || 0
    });

    // 8. Extract cost data from response
    const totalAmount = trackdriveData.totals?.amount || 0;
    const chargeCount = trackdriveData.totals?.charges_count || 0;
    
    console.log('💰 [TRACKDRIVE-CRON] Extracted costs:', {
      totalAmount,
      chargeCount,
      period: `${fromTime.toISOString()} to ${toTime.toISOString()}`
    });

    // 9. Store in database
    const { data, error } = await supabase
      .from('trackdrive_cost_history')
      .insert([
        {
          offer_id: 'ACABA',
          total_amount: totalAmount,
          charge_count: chargeCount,
          period_start: fromTime.toISOString(),
          period_end: toTime.toISOString(),
          api_response: trackdriveData,
          status: 'success'
        }
      ])
      .select();

    if (error) {
      console.error('❌ [TRACKDRIVE-CRON] Database insert error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database insert failed',
          details: error.message,
          timestamp: startTime.toISOString()
        },
        { status: 500 }
      );
    }

    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();
    
    console.log(`✅ [TRACKDRIVE-CRON] ======= CRON JOB COMPLETED in ${executionTimeMs}ms =======`);
    console.log('📈 [TRACKDRIVE-CRON] Summary:', {
      totalAmount: `$${totalAmount}`,
      chargeCount,
      periodHours: 1,
      recordId: data?.[0]?.id,
      executionTime: `${executionTimeMs}ms`
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAmount,
        chargeCount,
        periodStart: fromTime.toISOString(),
        periodEnd: toTime.toISOString(),
        recordId: data?.[0]?.id,
        executionTime: `${executionTimeMs}ms`
      },
      timestamp: endTime.toISOString()
    });

  } catch (error) {
    console.error('💥 [TRACKDRIVE-CRON] Unexpected error:', error);
    const endTime = new Date();
    const executionTimeMs = endTime.getTime() - startTime.getTime();
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unexpected error during cron execution',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTimeMs}ms`,
        timestamp: endTime.toISOString()
      },
      { status: 500 }
    );
  }
}