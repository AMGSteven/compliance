/**
 * Ping Analysis - Stats API
 * 
 * Returns list-level duplicate statistics using PostgreSQL RPC function.
 * Handles ALL data with SQL aggregation - no row limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const vertical = searchParams.get('vertical');  // Optional filter
    const minDuplicateRate = parseFloat(searchParams.get('min_rate') || '0');
    const minPings = parseInt(searchParams.get('min_pings') || '0');
    
    const supabase = createServerClient();
    
    console.log('[PING STATS] Calling RPC function:', { startDate, endDate, vertical, minDuplicateRate, minPings });
    
    // Call PostgreSQL RPC function for aggregated stats
    const { data: results, error } = await supabase.rpc('get_ping_analysis_stats', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_vertical: vertical,
      p_min_rate: minDuplicateRate,
      p_min_pings: minPings
    });
    
    if (error) {
      console.error('[PING STATS] RPC error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database query failed: ' + error.message 
      }, { status: 500 });
    }
    
    console.log(`[PING STATS] Retrieved ${results?.length || 0} lists`);
    
    // Map column names from function to expected format
    const mappedResults = (results || []).map((row: any) => ({
      list_id: row.list_id_result,
      description: row.description_result,
      partner_name: row.partner_name_result,
      vertical: row.vertical_result,
      bid: parseFloat(row.bid_result),
      accepted: parseInt(row.accepted_result),
      duplicates: parseInt(row.duplicates_result),
      total_pings: parseInt(row.total_pings_result),
      duplicate_rate: parseFloat(row.duplicate_rate_result),
      unique_duplicate_phones: parseInt(row.unique_duplicate_phones_result),
      avg_days_between: parseFloat(row.avg_days_between_result),
      top_matched_lists: row.top_matched_lists_result
    }));
    
    // Calculate totals from results (with explicit types)
    const totalPingsSum = mappedResults.reduce((sum: number, row: { total_pings: number; accepted: number; duplicates: number }) => sum + row.total_pings, 0);
    const totalAcceptedSum = mappedResults.reduce((sum: number, row: { total_pings: number; accepted: number; duplicates: number }) => sum + row.accepted, 0);
    const totalRejectionsSum = mappedResults.reduce((sum: number, row: { total_pings: number; accepted: number; duplicates: number }) => sum + row.duplicates, 0);
    
    return NextResponse.json({
      success: true,
      data: mappedResults,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        vertical_filter: vertical || 'all',
        total_lists: mappedResults.length,
        total_pings: totalPingsSum,
        total_accepted: totalAcceptedSum,
        total_rejections: totalRejectionsSum,
        overall_duplicate_rate: totalPingsSum > 0 ? ((totalRejectionsSum / totalPingsSum) * 100).toFixed(2) : '0.00',
        query_method: 'postgresql_rpc'
      }
    });
    
  } catch (error) {
    console.error('Error in ping-analysis stats API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
