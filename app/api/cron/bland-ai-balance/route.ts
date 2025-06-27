import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shared secret between Edge Function and this API route
const INTERNAL_TRIGGER_SECRET = process.env.INTERNAL_TRIGGER_SECRET;

/**
 * Cron job endpoint to automatically record Bland AI balance and calculate costs
 * This should be called every hour to track spending accurately
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
  } catch (e) {
    console.log('[BLAND-AI-DEBUG] API: No request body or invalid JSON');
  }

  // 1. Security Check
  const incomingSecret = req.headers.get('X-Internal-Trigger-Secret');
  if (!INTERNAL_TRIGGER_SECRET) {
    console.error('[BLAND-AI-DEBUG] API: INTERNAL_TRIGGER_SECRET environment variable is not set.');
    return NextResponse.json({ error: 'Internal Server Configuration Error' }, { status: 500 });
  }
  if (incomingSecret !== INTERNAL_TRIGGER_SECRET) {
    console.error('[BLAND-AI-DEBUG] API: Unauthorized attempt to trigger Bland AI balance. Secret mismatch.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[BLAND-AI-DEBUG] API: Authorized request - Recording Bland AI balance and calculating costs...');

  try {
    // Check Supabase environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[BLAND-AI-DEBUG] Missing Supabase environment variables:', {
        'NEXT_PUBLIC_SUPABASE_URL': supabaseUrl ? 'set' : 'missing',
        'DATABASE_SUPABASE_SERVICE_ROLE_KEY': supabaseKey ? 'set' : 'missing',
      });
      return NextResponse.json({ 
        success: false, 
        error: `Supabase environment variables missing: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!supabaseKey ? 'DATABASE_SUPABASE_SERVICE_ROLE_KEY' : ''}`
      }, { status: 500 });
    }
    
    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // Get current balance from Bland AI
    const balanceUrl = new URL('/api/bland-ai-balance', req.url);
    balanceUrl.searchParams.set('record', 'true');
    
    const balanceResponse = await fetch(balanceUrl.toString());
    const balanceData = await balanceResponse.json();

    if (!balanceData.success) {
      console.error('❌ Failed to fetch balance:', balanceData.error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch balance',
        details: balanceData.error
      }, { status: 500 });
    }

    // Get the last recorded balance to calculate cost
    const { data: lastRecord, error: queryError } = await supabase
      .from('bland_ai_balance_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(2); // Get last 2 records to calculate cost

    if (queryError) {
      console.error('❌ Database query error:', queryError);
      return NextResponse.json({
        success: false,
        error: 'Database query failed'
      }, { status: 500 });
    }

    let calculatedCost = 0;
    let periodHours = 0;
    let currentRecord = null;
    let previousRecord = null;

    if (lastRecord && lastRecord.length >= 2) {
      currentRecord = lastRecord[0]; // Most recent
      previousRecord = lastRecord[1]; // Previous record

      // Calculate time elapsed
      const currentTime = new Date(currentRecord.recorded_at);
      const previousTime = new Date(previousRecord.recorded_at);
      periodHours = (currentTime.getTime() - previousTime.getTime()) / (1000 * 60 * 60);

      // Calculate cost based on balance difference
      if (currentRecord.current_balance > previousRecord.current_balance) {
        // Refill happened - cost is previous balance + refill amount - current balance
        const refillAmount = currentRecord.refill_to || previousRecord.refill_to || 0;
        calculatedCost = previousRecord.current_balance + refillAmount - currentRecord.current_balance;
        console.log(`💰 Refill detected: $${previousRecord.current_balance} + $${refillAmount} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
      } else {
        // Normal spending - cost is previous balance - current balance
        calculatedCost = previousRecord.current_balance - currentRecord.current_balance;
        console.log(`💸 Normal spend: $${previousRecord.current_balance} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
      }

      // Update the current record with calculated cost
      const { error: updateError } = await supabase
        .from('bland_ai_balance_history')
        .update({ 
          calculated_cost: calculatedCost,
          period_hours: Math.round(periodHours * 100) / 100 // Round to 2 decimals
        })
        .eq('id', currentRecord.id);

      if (updateError) {
        console.error('❌ Failed to update calculated cost:', updateError);
      }

      // Now also populate the bland_ai_costs_calculated table for the dashboard
      const { error: insertError } = await supabase
        .from('bland_ai_costs_calculated')
        .insert([
          {
            recorded_at: currentRecord.recorded_at,
            current_balance: currentRecord.current_balance,
            refill_to: currentRecord.refill_to,
            total_calls: currentRecord.total_calls,
            previous_balance: previousRecord.current_balance,
            previous_refill_to: previousRecord.refill_to,
            previous_recorded_at: previousRecord.recorded_at,
            calculated_cost_period: calculatedCost,
            hours_elapsed: periodHours
          }
        ]);

      if (insertError) {
        console.error('❌ Failed to insert into bland_ai_costs_calculated:', insertError);
      } else {
        console.log('✅ Successfully inserted cost data into bland_ai_costs_calculated');
      }
    }

    console.log('✅ Cron job completed successfully');
    
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
    console.error('❌ Cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also allow GET for manual testing
export async function GET(req: NextRequest) {
  return POST(req);
}
