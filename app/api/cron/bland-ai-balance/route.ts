import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shared secret between Edge Function and this API route
const INTERNAL_TRIGGER_SECRET = process.env.INTERNAL_TRIGGER_SECRET;

/**
 * Cron job endpoint to automatically record Bland AI balance and calculate costs
 * This should be called every hour to track spending accurately
 */
export async function POST(req: NextRequest) {
  const startTime = new Date();
  console.log(`\n🔄 [BLAND-AI-CRON] ======= CRON JOB STARTED at ${startTime.toISOString()} =======`);
  
  try {
    const body = await req.json();
    console.log('[BLAND-AI-CRON] Request body received:', body);
  } catch (e) {
    console.log('[BLAND-AI-CRON] No request body or invalid JSON - this is normal for cron jobs');
  }

  // 1. Security Check - Handle both Vercel cron and internal triggers
  const incomingSecret = req.headers.get('X-Internal-Trigger-Secret');
  const authHeader = req.headers.get('Authorization');
  const vercelCronSecret = process.env.CRON_SECRET;
  const internalTriggerSecret = process.env.INTERNAL_TRIGGER_SECRET;
  
  console.log('[BLAND-AI-CRON] Environment check:', {
    vercelCronSecret: vercelCronSecret ? 'SET' : 'MISSING',
    internalTriggerSecret: internalTriggerSecret ? 'SET' : 'MISSING',
    authHeaderPresent: authHeader ? 'YES' : 'NO',
    internalSecretPresent: incomingSecret ? 'YES' : 'NO'
  });
  
  // Check if it's a Vercel cron request
  const isVercelCron = authHeader === `Bearer ${vercelCronSecret}`;
  const isInternalTrigger = incomingSecret === internalTriggerSecret;
  
  console.log('[BLAND-AI-CRON] Authentication check:', {
    isVercelCron,
    isInternalTrigger,
    authMatches: authHeader === `Bearer ${vercelCronSecret}`,
    secretMatches: incomingSecret === internalTriggerSecret
  });
  
  if (!isVercelCron && !isInternalTrigger) {
    console.error('❌ [BLAND-AI-CRON] UNAUTHORIZED ACCESS ATTEMPT!');
    console.error('[BLAND-AI-CRON] Expected auth header:', `Bearer ${vercelCronSecret}`);
    console.error('[BLAND-AI-CRON] Received auth header:', authHeader);
    console.error('[BLAND-AI-CRON] Expected internal secret:', internalTriggerSecret);
    console.error('[BLAND-AI-CRON] Received internal secret:', incomingSecret);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const triggerSource = isVercelCron ? 'Vercel cron' : 'internal trigger';
  console.log(`✅ [BLAND-AI-CRON] AUTHORIZED ${triggerSource} request - Recording Bland AI balance...`);

  try {
    // Check Supabase environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
    
    console.log('🔗 [BLAND-AI-CRON] Checking Supabase environment variables...');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [BLAND-AI-CRON] Missing Supabase environment variables:', {
        'NEXT_PUBLIC_SUPABASE_URL': supabaseUrl ? 'SET' : 'MISSING',
        'DATABASE_SUPABASE_SERVICE_ROLE_KEY': supabaseKey ? 'SET' : 'MISSING',
      });
      return NextResponse.json({ 
        success: false, 
        error: `Supabase environment variables missing: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!supabaseKey ? 'DATABASE_SUPABASE_SERVICE_ROLE_KEY' : ''}`
      }, { status: 500 });
    }
    
    console.log('✅ [BLAND-AI-CRON] Supabase environment variables are present');
    
    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // Get current balance from Bland AI (call directly to avoid Vercel deployment protection)
    console.log('💰 [BLAND-AI-CRON] Fetching current balance from Bland AI...');
    
    // Call the balance fetching logic directly instead of HTTP fetch
    let balanceData;
    try {
      if (!process.env.BLAND_AI_API_KEY) {
        throw new Error('Bland AI API key not configured');
      }

      console.log('[BLAND-AI-CRON] Fetching balance directly from Bland AI API...');
      const response = await fetch('https://api.bland.ai/v1/me', {
        method: 'GET',
        headers: {
          'Authorization': process.env.BLAND_AI_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BLAND-AI-CRON] Bland AI API error: ${response.status} - ${errorText}`);
        throw new Error(`Bland AI API returned ${response.status}: ${response.statusText}`);
      }

      const accountData = await response.json();
      const current_balance = accountData.billing?.current_balance || 0;
      
      console.log('[BLAND-AI-CRON] Raw Bland AI response:', accountData);
      
      // Record the balance to database
      const { error: insertError } = await supabase
        .from('bland_ai_balance_history')
        .insert({
          current_balance: current_balance,
          refill_to: accountData.billing?.refill_to || 100,
          total_calls: accountData.total_calls || 0,
          status: accountData.status || 'active'
        });

      if (insertError) {
        console.error('[BLAND-AI-CRON] Error inserting balance record:', insertError);
        throw new Error(`Database insert error: ${insertError.message}`);
      }

      balanceData = {
        success: true,
        status: accountData.status || 'active',
        current_balance: current_balance,
        refill_to: accountData.billing?.refill_to || 100,
        total_calls: accountData.total_calls || 0,
        recorded_at: new Date().toISOString()
      };
      
      console.log('[BLAND-AI-CRON] Balance recorded successfully');
    } catch (error) {
      console.error('❌ [BLAND-AI-CRON] Error fetching/recording balance:', error);
      return NextResponse.json({
        success: false,
        error: `Balance fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, { status: 500 });
    }
    
    console.log('[BLAND-AI-CRON] Balance fetched and recorded:', {
      success: balanceData.success,
      current_balance: balanceData.current_balance,
      status: balanceData.status
    });
    
    console.log('✅ [BLAND-AI-CRON] Balance fetched successfully:', `$${balanceData.current_balance}`);

    // Get the last recorded balance to calculate cost
    console.log('📊 [BLAND-AI-CRON] Querying database for previous balance records...');
    const { data: lastRecord, error: queryError } = await supabase
      .from('bland_ai_balance_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(2); // Get last 2 records to calculate cost

    if (queryError) {
      console.error('❌ [BLAND-AI-CRON] Database query error:', queryError);
      return NextResponse.json({
        success: false,
        error: 'Database query failed'
      }, { status: 500 });
    }
    
    console.log('[BLAND-AI-CRON] Database query results:', {
      recordCount: lastRecord?.length || 0,
      mostRecentBalance: lastRecord?.[0]?.current_balance,
      previousBalance: lastRecord?.[1]?.current_balance
    });

    let calculatedCost = 0;
    let periodHours = 0;
    
    console.log('🧮 [BLAND-AI-CRON] Calculating costs based on balance difference...');
    
    if (lastRecord && lastRecord.length >= 2) {
      const currentRecord = lastRecord[0]; // Most recent
      const previousRecord = lastRecord[1]; // Previous record

      // Calculate the time period
      const currentTime = new Date(currentRecord.recorded_at);
      const previousTime = new Date(previousRecord.recorded_at);
      periodHours = (currentTime.getTime() - previousTime.getTime()) / (1000 * 60 * 60);

      // Calculate the cost based on balance difference
      if (currentRecord.current_balance > previousRecord.current_balance) {
        // Refill happened - cost is previous balance + refill amount - current balance
        const refillAmount = currentRecord.refill_to || previousRecord.refill_to || 0;
        calculatedCost = previousRecord.current_balance + refillAmount - currentRecord.current_balance;
        console.log(`💰 [BLAND-AI-CRON] Refill detected: $${previousRecord.current_balance} + $${refillAmount} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
      } else {
        // Normal spending - cost is previous balance - current balance
        calculatedCost = previousRecord.current_balance - currentRecord.current_balance;
        console.log(`💸 [BLAND-AI-CRON] Normal spend: $${previousRecord.current_balance} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
      }
      
      console.log(`⏱️  [BLAND-AI-CRON] Time period: ${periodHours.toFixed(2)} hours (${previousRecord.recorded_at} → ${currentRecord.recorded_at})`);

      // Update the current record with calculated cost
      const { error: updateError } = await supabase
        .from('bland_ai_balance_history')
        .update({ 
          calculated_cost: calculatedCost,
          period_hours: Math.round(periodHours) // Convert to integer as required by schema
        })
        .eq('id', currentRecord.id);

      if (updateError) {
        console.error('❌ [BLAND-AI-CRON] Failed to update calculated cost:', updateError);
      } else {
        console.log('✅ [BLAND-AI-CRON] Successfully updated balance history with calculated cost');
        console.log('ℹ️  [BLAND-AI-CRON] Cost data automatically available in bland_ai_costs_calculated view');
      }
    } else {
      console.log('⚠️  [BLAND-AI-CRON] Not enough previous records to calculate costs (need at least 2 records)');
    }

    const endTime = new Date();
    const executionTime = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
    console.log(`✅ [BLAND-AI-CRON] ======= CRON JOB COMPLETED in ${executionTime}s at ${endTime.toISOString()} =======\n`);
    
    return NextResponse.json({
      success: true,
      message: 'Balance recorded and costs calculated successfully',
      data: {
        current_balance: balanceData.current_balance,
        refill_to: balanceData.refill_to,
        total_calls: balanceData.total_calls,
        calculated_cost: calculatedCost,
        period_hours: periodHours,
        records_count: lastRecord?.length || 0
      }
    });

  } catch (error) {
    const endTime = new Date();
    const executionTime = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
    console.error(`❌ [BLAND-AI-CRON] ======= CRON JOB FAILED after ${executionTime}s at ${endTime.toISOString()} =======`);
    console.error('[BLAND-AI-CRON] Error details:', error);
    console.error('[BLAND-AI-CRON] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        timestamp: endTime.toISOString(),
        executionTime: `${executionTime}s`
      }
    }, { status: 500 });
  }
}

// Also allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
