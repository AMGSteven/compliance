/**
 * Ping Analysis - Heatmap API
 * 
 * Returns cross-list duplicate matrix for heat map visualization.
 * Uses PostgreSQL RPC function for SQL aggregation - no row limits.
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
    const vertical = searchParams.get('vertical');  // Should be specified for heat map
    const minThreshold = parseInt(searchParams.get('min_threshold') || '0');
    const minPings = parseInt(searchParams.get('min_pings') || '0');
    
    const supabase = createServerClient();
    
    console.log('[HEATMAP] Calling RPC function:', { startDate, endDate, vertical, minThreshold, minPings });
    
    // Call the stats function to get list-level data with top_matched_lists
    // This gives us the matrix data we need for the heat map
    const { data: statsResults, error: statsError } = await supabase.rpc('get_ping_analysis_stats', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_vertical: vertical,
      p_min_rate: 0,  // Get all lists, we'll filter by threshold in the matrix
      p_min_pings: minPings
    });
    
    if (statsError) {
      console.error('[HEATMAP] Stats RPC error:', statsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch heat map data: ' + statsError.message 
      }, { status: 500 });
    }
    
    // Extract all lists that have activity
    const lists = (statsResults || [])
      .filter((row: any) => parseInt(row.total_pings_result) > 0)
      .map((row: any) => ({
        list_id: row.list_id_result,
        description: row.description_result,
        partner_name: row.partner_name_result,
        vertical: row.vertical_result
      }));
    
    // Build matrix from top_matched_lists in each row
    const matrixData: any[] = [];
    
    statsResults?.forEach((row: any) => {
      const incomingListId = row.list_id_result;
      const topMatched = row.top_matched_lists_result || [];
      
      // Add each matched list as a matrix cell
      topMatched.forEach((matched: any) => {
        if (matched.duplicate_count >= minThreshold) {
          matrixData.push({
            incoming_list_id: incomingListId,
            incoming_description: row.description_result,
            incoming_partner: row.partner_name_result,
            incoming_vertical: row.vertical_result,
            matched_list_id: matched.list_id,
            matched_description: matched.description,
            matched_partner: matched.partner_name,
            matched_vertical: row.vertical_result,  // Same vertical for heat map
            duplicate_count: matched.duplicate_count,
            unique_phones: matched.duplicate_count,  // Approximate
            duplicate_rate: row.total_pings_result > 0 
              ? ((matched.duplicate_count / row.total_pings_result) * 100).toFixed(2)
              : 0
          });
        }
      });
    });
    
    console.log(`[HEATMAP] Generated ${matrixData.length} matrix cells from ${lists.length} lists`);
    
    return NextResponse.json({
      success: true,
      data: {
        matrix: matrixData,
        lists: lists
      },
      metadata: {
        start_date: startDate,
        end_date: endDate,
        vertical_filter: vertical || 'all',
        total_pairs: matrixData.length,
        total_lists: lists.length,
        min_threshold: minThreshold,
        query_method: 'postgresql_rpc'
      }
    });
    
  } catch (error) {
    console.error('Error in ping-analysis heatmap API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
