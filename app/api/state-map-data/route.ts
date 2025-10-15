/**
 * State Map Data API
 * 
 * Returns lead counts and statistics aggregated by US state.
 * Used for choropleth map visualization on the main dashboard.
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
    const vertical = searchParams.get('vertical');  // Optional: 'ACA', 'Medicare', 'Final Expense'
    
    const supabase = createServerClient();
    
    console.log('[STATE MAP] Fetching state data:', { startDate, endDate, vertical });
    
    // Call PostgreSQL RPC function for state aggregation
    const { data: results, error } = await supabase.rpc('get_state_map_data', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_vertical: vertical
    });
    
    if (error) {
      console.error('[STATE MAP] RPC error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch state data: ' + error.message 
      }, { status: 500 });
    }
    
    console.log(`[STATE MAP] Retrieved data for ${results?.length || 0} states`);
    
    // Calculate min/max for color scaling
    const leadCounts = results?.map((r: any) => parseInt(r.total_leads)) || [];
    const minLeads = leadCounts.length > 0 ? Math.min(...leadCounts) : 0;
    const maxLeads = leadCounts.length > 0 ? Math.max(...leadCounts) : 0;
    const totalLeads = leadCounts.reduce((sum: number, count: number) => sum + count, 0);
    
    return NextResponse.json({
      success: true,
      data: results || [],
      metadata: {
        start_date: startDate,
        end_date: endDate,
        vertical_filter: vertical || 'all',
        total_states: results?.length || 0,
        total_leads: totalLeads,
        min_leads: minLeads,
        max_leads: maxLeads,
        query_method: 'postgresql_rpc'
      }
    });
    
  } catch (error) {
    console.error('Error in state-map-data API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

