import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron job endpoint to automatically record Bland AI balance and calculate costs
 * This should be called every hour to track spending accurately
 */
export async function POST(request: NextRequest) {
  // Vercel cron jobs include this header automatically
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Cron job: Recording Bland AI balance and calculating costs...');

  try {
    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get current balance from Bland AI
    const balanceUrl = new URL('/api/bland-ai-balance', request.url);
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
export async function GET(request: NextRequest) {
  return POST(request);
}
