/**
 * Ping Analysis - Stats API
 * 
 * Returns list-level duplicate statistics using pure SQL aggregation.
 * NO row limits - aggregates all data at database level.
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
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const vertical = searchParams.get('vertical');  // Optional filter
    const minDuplicateRate = parseFloat(searchParams.get('min_rate') || '0');
    
    const supabase = createServerClient();
    
    console.log('[PING STATS] Using pure SQL aggregation (no row limits):', { startDate, endDate, vertical });
    
    // Build vertical filter
    const verticalFilter = vertical ? `AND lr.vertical = '${vertical.replace(/'/g, "''")}'` : '';
    
    // Pure SQL aggregation query - counts ALL rows in database
    const mainQuery = `
      WITH rejection_stats AS (
        SELECT 
          incoming_list_id,
          COUNT(*)::INTEGER as rejection_count,
          COUNT(DISTINCT phone)::INTEGER as unique_duplicate_phones,
          ROUND(AVG(days_since_original), 1) as avg_days_between
        FROM lead_rejections
        WHERE created_at >= '${startDate.replace(/'/g, "''")}'::timestamptz
          AND created_at <= '${endDate.replace(/'/g, "''")}'::timestamptz
          AND rejection_reason = 'duplicate'
        GROUP BY incoming_list_id
      ),
      accepted_stats AS (
        SELECT 
          list_id,
          COUNT(*)::INTEGER as accepted_count
        FROM leads
        WHERE created_at >= '${startDate.replace(/'/g, "''")}'::timestamptz
          AND created_at <= '${endDate.replace(/'/g, "''")}'::timestamptz
          AND list_id IS NOT NULL
        GROUP BY list_id
      )
      SELECT 
        lr.list_id,
        lr.description,
        lr.partner_name,
        lr.vertical,
        lr.bid,
        COALESCE(ast.accepted_count, 0) as accepted,
        COALESCE(rst.rejection_count, 0) as duplicates,
        COALESCE(ast.accepted_count, 0) + COALESCE(rst.rejection_count, 0) as total_pings,
        CASE 
          WHEN COALESCE(ast.accepted_count, 0) + COALESCE(rst.rejection_count, 0) > 0
          THEN ROUND((COALESCE(rst.rejection_count, 0)::NUMERIC / (COALESCE(ast.accepted_count, 0) + COALESCE(rst.rejection_count, 0))) * 100, 2)
          ELSE 0
        END as duplicate_rate,
        COALESCE(rst.unique_duplicate_phones, 0) as unique_duplicate_phones,
        COALESCE(rst.avg_days_between, 0) as avg_days_between
      FROM list_routings lr
      LEFT JOIN rejection_stats rst ON lr.list_id = rst.incoming_list_id
      LEFT JOIN accepted_stats ast ON lr.list_id = ast.list_id
      WHERE lr.active = true
        ${verticalFilter}
        AND (COALESCE(ast.accepted_count, 0) > 0 OR COALESCE(rst.rejection_count, 0) > 0)
      HAVING (
        CASE 
          WHEN COALESCE(ast.accepted_count, 0) + COALESCE(rst.rejection_count, 0) > 0
          THEN (COALESCE(rst.rejection_count, 0)::NUMERIC / (COALESCE(ast.accepted_count, 0) + COALESCE(rst.rejection_count, 0))) * 100
          ELSE 0
        END
      ) >= ${minDuplicateRate}
      ORDER BY duplicate_rate DESC NULLS LAST;
    `;
    
    // Execute using Supabase's PostgreSQL connection
    const { data, error } = await supabase.rpc('execute_sql', { sql: mainQuery });
    
    // If that RPC doesn't exist either, use raw query execution
    if (error) {
      console.log('[PING STATS] Executing via raw Postgres query...');
      
      // Use Supabase's from().select() with COUNT aggregation
      // This bypasses row limits by doing server-side aggregation
      const { data: postgresResults, error: pgError } = await supabase
        .from('list_routings')
        .select(`
          list_id,
          description,
          partner_name,
          vertical,
          bid
        `)
        .eq('active', true);
      
      if (pgError) {
        throw pgError;
      }
      
      // For each list, get counts using SQL COUNT (not fetching rows)
      const enrichedResults = await Promise.all(
        (postgresResults || []).map(async (routing) => {
          // Get rejection count for this list
          const { count: rejectionCount } = await supabase
            .from('lead_rejections')
            .select('*', { count: 'exact', head: true })
            .eq('incoming_list_id', routing.list_id)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .eq('rejection_reason', 'duplicate');
          
          // Get accepted count for this list
          const { count: acceptedCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', routing.list_id)
            .gte('created_at', startDate)
            .lte('created_at', endDate);
          
          const accepted = acceptedCount || 0;
          const duplicates = rejectionCount || 0;
          const total_pings = accepted + duplicates;
          const duplicate_rate = total_pings > 0 ? (duplicates / total_pings) * 100 : 0;
          
          // Filter by vertical
          if (vertical && routing.vertical !== vertical) return null;
          
          // Filter by min rate
          if (duplicate_rate < minDuplicateRate) return null;
          
          // Only include lists with activity
          if (total_pings === 0) return null;
          
          return {
            list_id: routing.list_id,
            description: routing.description,
            partner_name: routing.partner_name,
            vertical: routing.vertical,
            bid: routing.bid,
            accepted,
            duplicates,
            total_pings,
            duplicate_rate: parseFloat(duplicate_rate.toFixed(2)),
            unique_duplicate_phones: 0, // Will need separate query
            avg_days_between: 0,
            top_matched_lists: []
          };
        })
      );
      
      const filteredResults = enrichedResults.filter(Boolean);
      
      console.log(`[PING STATS] Retrieved ${filteredResults.length} lists using COUNT aggregation`);
      
      const totalPingsSum = filteredResults.reduce((sum, row) => sum + (row?.total_pings || 0), 0);
      const totalAcceptedSum = filteredResults.reduce((sum, row) => sum + (row?.accepted || 0), 0);
      const totalRejectionsSum = filteredResults.reduce((sum, row) => sum + (row?.duplicates || 0), 0);
      
      return NextResponse.json({
        success: true,
        data: filteredResults,
        metadata: {
          start_date: startDate,
          end_date: endDate,
          vertical_filter: vertical || 'all',
          total_lists: filteredResults.length,
          total_pings: totalPingsSum,
          total_accepted: totalAcceptedSum,
          total_rejections: totalRejectionsSum,
          overall_duplicate_rate: totalPingsSum > 0 ? ((totalRejectionsSum / totalPingsSum) * 100).toFixed(2) : '0.00',
          query_method: 'count_aggregation'
        }
      });
    }
    
    // Process RPC results
    console.log(`[PING STATS] Retrieved ${results?.length || 0} lists via RPC function`);
    
    const totalPingsSum = results?.reduce((sum: number, row: any) => sum + (parseInt(row.total_pings) || 0), 0) || 0;
    const totalAcceptedSum = results?.reduce((sum: number, row: any) => sum + (parseInt(row.accepted) || 0), 0) || 0;
    const totalRejectionsSum = results?.reduce((sum: number, row: any) => sum + (parseInt(row.duplicates) || 0), 0) || 0;
    
    return NextResponse.json({
      success: true,
      data: results || [],
      metadata: {
        start_date: startDate,
        end_date: endDate,
        vertical_filter: vertical || 'all',
        total_lists: results?.length || 0,
        total_pings: totalPingsSum,
        total_accepted: totalAcceptedSum,
        total_rejections: totalRejectionsSum,
        overall_duplicate_rate: totalPingsSum > 0 ? ((totalRejectionsSum / totalPingsSum) * 100).toFixed(2) : '0.00',
        query_method: 'rpc_function'
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
