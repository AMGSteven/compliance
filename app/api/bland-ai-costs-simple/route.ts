import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'today'; // today, week, month, all
  const hours = searchParams.get('hours'); // Custom hours (e.g., last 24 hours)
  const startDate = searchParams.get('startDate'); // Custom start date (YYYY-MM-DD)
  const endDate = searchParams.get('endDate'); // Custom end date (YYYY-MM-DD)

  try {
    // Initialize Supabase client inside function to avoid build-time evaluation
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
    }
    if (!process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('DATABASE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
    );

    let query = supabase
      .from('bland_ai_costs_calculated')
      .select('*')
      .order('recorded_at', { ascending: false });

    // Apply time filters - all calculations in EST timezone
    const now = new Date();
    // Convert current time to EST for consistent date calculations
    const nowEST = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    let startTime: Date;
    let endTime: Date;

    if (startDate && endDate) {
      // Custom date range filter
      startTime = new Date(startDate + 'T00:00:00-05:00'); // EST timezone
      endTime = new Date(endDate + 'T23:59:59-05:00'); // EST timezone
      query = query
        .gte('recorded_at', startTime.toISOString())
        .lte('recorded_at', endTime.toISOString());
    } else if (hours) {
      // Custom hours filter
      startTime = new Date(now.getTime() - (parseInt(hours) * 60 * 60 * 1000));
      query = query.gte('recorded_at', startTime.toISOString());
    } else {
      switch (period) {
        case 'today':
          // Start of today in EST
          startTime = new Date(nowEST.getFullYear(), nowEST.getMonth(), nowEST.getDate());
          // Convert back to UTC for database query
          startTime = new Date(startTime.getTime() + (5 * 60 * 60 * 1000)); // Add 5 hours to convert EST to UTC
          query = query.gte('recorded_at', startTime.toISOString());
          break;
        case 'yesterday':
          // Start of yesterday in EST
          const yesterdayEST = new Date(nowEST.getTime() - (24 * 60 * 60 * 1000));
          startTime = new Date(yesterdayEST.getFullYear(), yesterdayEST.getMonth(), yesterdayEST.getDate());
          endTime = new Date(startTime.getTime() + (24 * 60 * 60 * 1000) - 1); // End of yesterday
          // Convert back to UTC for database query
          startTime = new Date(startTime.getTime() + (5 * 60 * 60 * 1000)); // Add 5 hours to convert EST to UTC
          endTime = new Date(endTime.getTime() + (5 * 60 * 60 * 1000)); // Add 5 hours to convert EST to UTC
          query = query
            .gte('recorded_at', startTime.toISOString())
            .lte('recorded_at', endTime.toISOString());
          break;
        case 'week':
          // 7 days ago from now
          startTime = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          query = query.gte('recorded_at', startTime.toISOString());
          break;
        case 'month':
          // Start of current month in EST
          startTime = new Date(nowEST.getFullYear(), nowEST.getMonth(), 1);
          // Convert back to UTC for database query
          startTime = new Date(startTime.getTime() + (5 * 60 * 60 * 1000)); // Add 5 hours to convert EST to UTC
          query = query.gte('recorded_at', startTime.toISOString());
          break;
        case 'all':
          // No time filter
          break;
        default:
          // Default to today
          startTime = new Date(nowEST.getFullYear(), nowEST.getMonth(), nowEST.getDate());
          // Convert back to UTC for database query
          startTime = new Date(startTime.getTime() + (5 * 60 * 60 * 1000)); // Add 5 hours to convert EST to UTC
          query = query.gte('recorded_at', startTime.toISOString());
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database query failed' 
      }, { status: 500 });
    }

    // Calculate totals
    const totalCost = data?.reduce((sum, record) => sum + (parseFloat(record.calculated_cost_period) || 0), 0) || 0;
    const totalRecords = data?.length || 0;
    
    // Get current balance from most recent record
    const currentBalance = data?.[0]?.current_balance || 0;
    const refillTo = data?.[0]?.refill_to || null;

    // Calculate average cost per hour
    const totalHours = data?.reduce((sum, record) => sum + (record.hours_elapsed || 0), 0) || 0;
    const avgCostPerHour = totalHours > 0 ? totalCost / totalHours : 0;

    return NextResponse.json({
      success: true,
      period: startDate && endDate ? `${startDate} to ${endDate}` : period,
      totalCost: Math.round(totalCost * 100) / 100, // Round to 2 decimals
      totalRecords,
      currentBalance: Math.round(currentBalance * 100) / 100,
      refillTo,
      avgCostPerHour: Math.round(avgCostPerHour * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      records: data?.map(record => ({
        recorded_at: record.recorded_at,
        current_balance: record.current_balance,
        calculated_cost: record.calculated_cost_period,
        hours_elapsed: record.hours_elapsed,
        total_calls: record.total_calls
      })) || []
    });

  } catch (error) {
    console.error('Error fetching Bland AI costs:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
