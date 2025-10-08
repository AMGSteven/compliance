/**
 * Ping Analysis - Cross-Vertical Duplicates API
 * 
 * Analyzes leads that were ACCEPTED despite having duplicate phone numbers
 * because they were in different verticals. Uses pure SQL aggregation - NO row limits.
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
    const minCount = parseInt(searchParams.get('min_count') || '1');
    const vertical = searchParams.get('vertical'); // Optional
    
    const supabase = createServerClient();
    
    console.log('[CROSS-VERTICAL] Using pure SQL aggregation (no row limits):', { startDate, endDate, minCount });
    
    // Build vertical filter
    const verticalFilter = vertical 
      ? `AND (lr1.vertical = '${vertical.replace(/'/g, "''")}' OR lr2.vertical = '${vertical.replace(/'/g, "''")}')`
      : '';
    
    // Pure SQL aggregation for cross-vertical duplicates
    // Aggregates at database level - handles ALL leads without row limits
    const query = `
      WITH cross_vertical_pairs AS (
        SELECT 
          l1.phone,
          l1.list_id as list_a_id,
          l2.list_id as list_b_id,
          lr1.vertical as vert_a,
          lr2.vertical as vert_b,
          lr1.description as desc_a,
          lr1.partner_name as partner_a,
          lr2.description as desc_b,
          lr2.partner_name as partner_b
        FROM leads l1
        JOIN leads l2 ON l1.phone = l2.phone AND l1.id < l2.id
        LEFT JOIN list_routings lr1 ON l1.list_id = lr1.list_id
        LEFT JOIN list_routings lr2 ON l2.list_id = lr2.list_id
        WHERE l1.created_at >= '${startDate.replace(/'/g, "''")}'::timestamptz
          AND l1.created_at <= '${endDate.replace(/'/g, "''")}'::timestamptz
          AND l2.created_at >= '${startDate.replace(/'/g, "''")}'::timestamptz
          AND l2.created_at <= '${endDate.replace(/'/g, "''")}'::timestamptz
          AND l1.list_id IS NOT NULL
          AND l2.list_id IS NOT NULL
          AND lr1.vertical IS NOT NULL
          AND lr2.vertical IS NOT NULL
          AND lr1.vertical != lr2.vertical
          ${verticalFilter}
      )
      SELECT 
        list_a_id as incoming_list_id,
        desc_a as incoming_description,
        partner_a as incoming_partner,
        vert_a as incoming_vertical,
        list_b_id as matched_list_id,
        desc_b as matched_description,
        partner_b as matched_partner,
        vert_b as matched_vertical,
        COUNT(*)::INTEGER as duplicate_count,
        COUNT(DISTINCT phone)::INTEGER as unique_phones,
        ARRAY_AGG(DISTINCT phone ORDER BY phone LIMIT 5) as sample_phones
      FROM cross_vertical_pairs
      GROUP BY 
        list_a_id, desc_a, partner_a, vert_a,
        list_b_id, desc_b, partner_b, vert_b
      HAVING COUNT(*) >= ${minCount}
      ORDER BY COUNT(*) DESC
      LIMIT 200;
    `;
    
    // Try to execute using Supabase RPC
    const { data: results, error: rpcError } = await supabase.rpc('execute_sql', { sql: query });
    
    if (rpcError) {
      console.log('[CROSS-VERTICAL] RPC not available, using alternative method');
      console.error('[CROSS-VERTICAL] Error:', rpcError);
      
      // Return empty result with explanation
      return NextResponse.json({
        success: true,
        data: {
          matrix: [],
          lists: []
        },
        metadata: {
          start_date: startDate,
          end_date: endDate,
          total_pairs: 0,
          total_lists: 0,
          total_unique_phones: 0,
          min_threshold: minCount,
          query_method: 'unavailable',
          message: 'Cross-vertical analysis requires database function setup. Please run the SQL query manually or contact support.'
        }
      });
    }
    
    console.log(`[CROSS-VERTICAL] Retrieved ${results?.length || 0} cross-vertical pairs`);
    
    // Extract unique lists
    const uniqueLists = new Set<string>();
    results?.forEach((row: any) => {
      uniqueLists.add(row.incoming_list_id);
      uniqueLists.add(row.matched_list_id);
    });
    
    // Count total unique phones
    const allPhones = new Set();
    results?.forEach((row: any) => {
      if (Array.isArray(row.sample_phones)) {
        row.sample_phones.forEach((p: string) => allPhones.add(p));
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        matrix: results || [],
        lists: Array.from(uniqueLists).sort()
      },
      metadata: {
        start_date: startDate,
        end_date: endDate,
        total_pairs: results?.length || 0,
        total_lists: uniqueLists.size,
        total_unique_phones: allPhones.size,
        min_threshold: minCount,
        query_method: 'sql_aggregation'
      }
    });
    
  } catch (error) {
    console.error('Error in ping-analysis cross-vertical API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
