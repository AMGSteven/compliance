import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Internal API endpoint for Bland AI balance calculation
 * Called by Supabase Edge Function cron job
 */
export async function POST(request: NextRequest) {
  // Check for internal trigger secret
  const internalSecret = request.headers.get('X-Internal-Trigger-Secret');
  const expectedSecret = process.env.INTERNAL_TRIGGER_SECRET;

  if (!expectedSecret || internalSecret !== expectedSecret) {
    console.error('❌ Unauthorized access to internal API');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Internal API: Recording Bland AI balance and calculating costs...');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get current balance from Bland AI API
    const blandApiKey = process.env.BLAND_AI_API_KEY;
    if (!blandApiKey) {
      throw new Error('BLAND_AI_API_KEY not configured');
    }

    const blandResponse = await fetch('https://api.bland.ai/v1/me', {
      headers: {
        'Authorization': blandApiKey
      }
    });

    if (!blandResponse.ok) {
      throw new Error(`Bland AI API error: ${blandResponse.status}`);
    }

    const blandData = await blandResponse.json();
    console.log('📊 Current Bland AI data:', blandData);

    // Record current balance in history
    const { data: insertData, error: insertError } = await supabase
      .from('bland_ai_balance_history')
      .insert([
        {
          current_balance: blandData.billing?.current_balance || 0,
          refill_to: blandData.billing?.refill_to || null,
          total_calls: blandData.total_calls || 0,
          status: blandData.status || 'active',
          recorded_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert balance record:', insertError);
      throw new Error('Failed to record balance');
    }

    console.log('✅ Balance recorded:', insertData);

    // Get the last 2 records to calculate cost
    const { data: lastRecords, error: queryError } = await supabase
      .from('bland_ai_balance_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(2);

    if (queryError) {
      console.error('❌ Database query error:', queryError);
      throw new Error('Database query failed');
    }

    let calculatedCost = 0;
    let periodHours = 0;
    let currentRecord = null;
    let previousRecord = null;

    if (lastRecords && lastRecords.length >= 2) {
      currentRecord = lastRecords[0]; // Most recent
      previousRecord = lastRecords[1]; // Previous record

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

      // Ensure calculated cost is not negative
      calculatedCost = Math.max(0, calculatedCost);

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

      // Insert into bland_ai_costs_calculated for dashboard consumption
      const { error: costsInsertError } = await supabase
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

      if (costsInsertError) {
        console.error('❌ Failed to insert into bland_ai_costs_calculated:', costsInsertError);
      } else {
        console.log('✅ Successfully inserted cost data into bland_ai_costs_calculated');
      }
    } else {
      console.log('📝 First balance record - no cost calculation possible yet');
    }

    console.log('✅ Bland AI balance cron job completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Balance recorded and costs calculated successfully',
      data: {
        current_balance: blandData.billing?.current_balance,
        refill_to: blandData.billing?.refill_to,
        total_calls: blandData.total_calls,
        calculated_cost: calculatedCost,
        period_hours: periodHours,
        records_count: lastRecords?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Internal API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
