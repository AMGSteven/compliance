import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Backfills bland_ai_costs_calculated table from bland_ai_balance_history data
 * This is a one-time operation to fix the missing cost data
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all records from bland_ai_balance_history ordered by recorded_at
    const { data: historyRecords, error: queryError } = await supabase
      .from('bland_ai_balance_history')
      .select('*')
      .order('recorded_at', { ascending: true });

    if (queryError) {
      console.error('Failed to fetch balance history:', queryError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    }

    if (!historyRecords || historyRecords.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Not enough history records to calculate costs'
      }, { status: 400 });
    }

    // Clear existing calculated costs table to avoid duplicates
    const { error: clearError } = await supabase
      .from('bland_ai_costs_calculated')
      .delete()
      .neq('id', 0); // Delete all records

    if (clearError) {
      console.error('Failed to clear existing calculated costs:', clearError);
      return NextResponse.json({
        success: false,
        error: 'Failed to clear existing calculated costs'
      }, { status: 500 });
    }

    // Process records in pairs to calculate costs
    const calculatedCosts = [];
    const inserts = [];

    for (let i = 1; i < historyRecords.length; i++) {
      const currentRecord = historyRecords[i];
      const previousRecord = historyRecords[i - 1];

      // Calculate time elapsed
      const currentTime = new Date(currentRecord.recorded_at);
      const previousTime = new Date(previousRecord.recorded_at);
      const periodHours = (currentTime.getTime() - previousTime.getTime()) / (1000 * 60 * 60);

      // Calculate cost based on balance difference
      let calculatedCost = 0;
      if (currentRecord.current_balance > previousRecord.current_balance) {
        // Refill happened - cost is previous balance + refill amount - current balance
        const refillAmount = currentRecord.refill_to || previousRecord.refill_to || 0;
        calculatedCost = previousRecord.current_balance + refillAmount - currentRecord.current_balance;
        console.log(`Refill detected: $${previousRecord.current_balance} + $${refillAmount} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
      } else {
        // Normal spending - cost is previous balance - current balance
        calculatedCost = previousRecord.current_balance - currentRecord.current_balance;
        console.log(`Normal spend: $${previousRecord.current_balance} - $${currentRecord.current_balance} = $${calculatedCost} spent`);
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
        console.error(`Failed to update calculated cost for record ${currentRecord.id}:`, updateError);
      }

      // Prepare insert for bland_ai_costs_calculated
      inserts.push({
        recorded_at: currentRecord.recorded_at,
        current_balance: currentRecord.current_balance,
        refill_to: currentRecord.refill_to,
        total_calls: currentRecord.total_calls,
        previous_balance: previousRecord.current_balance,
        previous_refill_to: previousRecord.refill_to,
        previous_recorded_at: previousRecord.recorded_at,
        calculated_cost_period: calculatedCost,
        hours_elapsed: periodHours
      });

      calculatedCosts.push({
        id: currentRecord.id,
        recorded_at: currentRecord.recorded_at,
        calculated_cost: calculatedCost,
        period_hours: periodHours
      });
    }

    // Insert calculated costs into bland_ai_costs_calculated
    const { data: insertedData, error: insertError } = await supabase
      .from('bland_ai_costs_calculated')
      .insert(inserts)
      .select();

    if (insertError) {
      console.error('Failed to insert calculated costs:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to insert calculated costs'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully backfilled calculated costs',
      totalRecords: calculatedCosts.length,
      insertedRecords: insertedData?.length || 0,
      calculatedCosts
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
