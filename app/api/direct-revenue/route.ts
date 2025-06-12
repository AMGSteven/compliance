import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Direct revenue check - no filtering');
    const supabase = createServerClient();
    
    // Known target list ID for Onpoint Global (from our direct query)
    const onpointListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
    const shift44ListId = 'ee5f90a3-6864-4b9e-9979-769928d14042'; // You mentioned Shift44 too
    
    // Get all list routings
    const { data: listRoutings } = await supabase
      .from('list_routings')
      .select('*')
      .eq('active', true);
      
    // Count leads using direct count for maximum accuracy
    const results = [];
    
    for (const routing of listRoutings || []) {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', routing.list_id)
        .eq('status', 'success');
        
      results.push({
        list_id: routing.list_id,
        description: routing.description,
        bid: routing.bid,
        lead_count: count || 0,
        revenue: (count || 0) * routing.bid
      });
      
      console.log(`Counted ${count} leads for ${routing.description || routing.list_id}`);
    }
    
    const totalRevenue = results.reduce((sum, item) => sum + item.revenue, 0);
    const totalLeads = results.reduce((sum, item) => sum + item.lead_count, 0);
    
    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        total_leads: totalLeads,
        total_revenue: totalRevenue,
        avg_bid: totalLeads > 0 ? totalRevenue / totalLeads : 0
      }
    });
  } catch (error: any) {
    console.error('Error in direct revenue API:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
