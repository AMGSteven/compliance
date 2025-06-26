import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron job endpoint to automatically record Bland AI balance
 * This should be called every few hours to track spending
 */
export async function POST(request: NextRequest) {
  // Optional: Add cron authentication header check
  const cronSecret = request.headers.get('x-cron-secret');
  // Temporarily disabled for testing
  // if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  console.log('🕐 Cron job: Recording Bland AI balance...');

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

    if (lastRecord && lastRecord.length >= 2) {
      const current = lastRecord[0]; // Most recent
      const previous = lastRecord[1]; // Previous record

      // Calculate time elapsed
      const currentTime = new Date(current.recorded_at);
      const previousTime = new Date(previous.recorded_at);
      periodHours = (currentTime.getTime() - previousTime.getTime()) / (1000 * 60 * 60);

      // Calculate cost based on balance difference
      if (current.current_balance > previous.current_balance) {
        // Refill happened - cost is previous balance + refill amount - current balance
        const refillAmount = current.refill_to || previous.refill_to || 0;
        calculatedCost = previous.current_balance + refillAmount - current.current_balance;
        console.log(`💰 Refill detected: $${previous.current_balance} + $${refillAmount} - $${current.current_balance} = $${calculatedCost} spent`);
      } else {
        // Normal spending - cost is previous balance - current balance
        calculatedCost = previous.current_balance - current.current_balance;
        console.log(`💸 Normal spend: $${previous.current_balance} - $${current.current_balance} = $${calculatedCost} spent`);
      }

      // Update the current record with calculated cost
      const { error: updateError } = await supabase
        .from('bland_ai_balance_history')
        .update({ 
          calculated_cost: calculatedCost,
          period_hours: Math.round(periodHours * 100) / 100 // Round to 2 decimals
        })
        .eq('id', current.id);

      if (updateError) {
        console.error('❌ Failed to update calculated cost:', updateError);
      }
    }

    console.log('✅ Cron job completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Balance recorded successfully',
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
