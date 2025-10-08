/**
 * Ping Analysis - Cross-Vertical Duplicates API
 * 
 * Analyzes leads that were ACCEPTED despite having duplicate phone numbers
 * because they were in different verticals. Uses PostgreSQL RPC function.
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
    
    const supabase = createServerClient();
    
    console.log('[CROSS-VERTICAL] Calling RPC function:', { startDate, endDate, minCount });
    
    // Call PostgreSQL RPC function
    const { data: results, error } = await supabase.rpc('get_cross_vertical_duplicates', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_min_count: minCount
    });
    
    if (error) {
      console.error('[CROSS-VERTICAL] RPC error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database query failed: ' + error.message 
      }, { status: 500 });
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
        query_method: 'postgresql_rpc'
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
