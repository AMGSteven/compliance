import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const summary = searchParams.get('summary') === 'true';

  try {
    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (summary) {
      // Use the optimized daily summary view for super fast queries
      let query = supabase
        .from('daily_bland_ai_costs')
        .select('*');

      if (date) {
        query = query.eq('created_date', date);
      } else if (startDate && endDate) {
        query = query
          .gte('created_date', startDate)
          .lte('created_date', endDate);
      }

      const { data, error } = await query.order('created_date', { ascending: false });

      if (error) {
        console.error('Database query error (summary):', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Database error',
          totalCost: 0,
          callCount: 0 
        });
      }

      if (date) {
        // Single day summary
        const dayData = data?.[0];
        return NextResponse.json({
          success: true,
          date,
          totalCost: parseFloat((dayData?.total_cost || 0).toFixed(2)),
          callCount: dayData?.total_calls || 0,
          avgCostPerCall: parseFloat((dayData?.avg_cost_per_call || 0).toFixed(4)),
          dataSource: 'database_view',
          message: `Retrieved from optimized daily summary view`
        });
      } else {
        // Date range summary
        const totalCost = data?.reduce((sum, day) => sum + (day.total_cost || 0), 0) || 0;
        const totalCalls = data?.reduce((sum, day) => sum + (day.total_calls || 0), 0) || 0;
        
        return NextResponse.json({
          success: true,
          dateRange: `${startDate} to ${endDate}`,
          totalCost: parseFloat(totalCost.toFixed(2)),
          callCount: totalCalls,
          avgCostPerCall: totalCalls > 0 ? parseFloat((totalCost / totalCalls).toFixed(4)) : 0,
          dailyBreakdown: data,
          dataSource: 'database_view',
          message: `Retrieved ${data?.length} days from optimized summary view`
        });
      }

    } else {
      // Detailed query on individual call records
      let query = supabase
        .from('bland_ai_call_costs')
        .select('cost, created_at, call_id, duration_seconds');

      if (date) {
        query = query.eq('created_date', date);
      } else if (startDate && endDate) {
        query = query
          .gte('created_date', startDate)
          .lte('created_date', endDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Database query error (detailed):', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Database error',
          totalCost: 0,
          callCount: 0 
        });
      }

      const totalCost = data?.reduce((sum, call) => sum + (call.cost || 0), 0) || 0;
      const callCount = data?.length || 0;

      return NextResponse.json({
        success: true,
        totalCost: parseFloat(totalCost.toFixed(2)),
        callCount,
        avgCostPerCall: callCount > 0 ? parseFloat((totalCost / callCount).toFixed(4)) : 0,
        date: date || `${startDate} to ${endDate}`,
        dataSource: 'database_detailed',
        message: `Retrieved ${callCount} individual call records`
      });
    }

  } catch (error) {
    console.error('Error fetching costs from database:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      totalCost: 0,
      callCount: 0 
    });
  }
}

// POST endpoint to bulk insert call data
export async function POST(request: NextRequest) {
  try {
    const { calls } = await request.json();
    
    if (!Array.isArray(calls) || calls.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid calls data - expected array' 
      }, { status: 400 });
    }

    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Transform API data to database format
    const callRecords = calls.map(call => ({
      call_id: call.id || call.call_id,
      created_at: call.created_at,
      cost: call.price || call.cost || 0,
      price: call.price || 0,
      duration_seconds: call.duration || null,
      status: call.status || null,
      from_number: call.from || null,
      to_number: call.to || null,
      webhook_data: call
    }));

    // Use upsert to handle duplicates gracefully
    const { data, error } = await supabase
      .from('bland_ai_call_costs')
      .upsert(callRecords, { 
        onConflict: 'call_id',
        ignoreDuplicates: false 
      })
      .select('call_id, cost');

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database insert failed' 
      }, { status: 500 });
    }

    const totalCost = data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      insertedRecords: data?.length || 0,
      totalCost: parseFloat(totalCost.toFixed(2)),
      message: `Successfully stored ${data?.length} call records`
    });

  } catch (error) {
    console.error('Error processing bulk insert:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid request data' 
    }, { status: 400 });
  }
}
