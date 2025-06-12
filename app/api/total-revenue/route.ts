import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching TOTAL revenue data directly from database...');
    const supabase = createServerClient();
    
    // STEP 1: Fetch ALL list routings with their bids
    const { data: listRoutings, error: routingsError } = await supabase
      .from('list_routings')
      .select('*');
    
    if (routingsError) {
      console.error('Error fetching list routings:', routingsError);
      return NextResponse.json({ success: false, error: routingsError.message });
    }
    
    console.log(`Found ${listRoutings.length} list routings`);

    // Create a custom SQL query to count leads by list_id
    const countQuery = `
      SELECT list_id, COUNT(*) as count
      FROM leads
      WHERE status = 'success'
      GROUP BY list_id
    `;
    
    const { data: leadsByListId, error: leadsError } = await supabase
      .rpc('execute_sql', { sql_query: countQuery });
    
    if (leadsError) {
      console.error('Error counting leads:', leadsError);
      
      // Fallback to direct count
      const results: any[] = [];
      
      // For each list ID, do a direct count
      for (const routing of listRoutings) {
        const { count, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', routing.list_id)
          .eq('status', 'success');
          
        if (!error) {
          results.push({
            list_id: routing.list_id,
            count: count || 0
          });
        }
      }
      
      console.log(`Counted ${results.length} list IDs directly`);
      
      // Use direct count results instead
      const revenueData = listRoutings
        .filter(routing => routing.active)
        .map(routing => {
          const leadCount = results.find(item => item.list_id === routing.list_id)?.count || 0;
          const totalRevenue = routing.bid * leadCount;
          
          return {
            list_id: routing.list_id,
            description: routing.description || routing.list_id,
            campaign_id: routing.campaign_id,
            bid_amount: routing.bid,
            lead_count: leadCount,
            total_revenue: totalRevenue
          };
        })
        .sort((a, b) => b.lead_count - a.lead_count);
      
      // Calculate overall totals
      const overallData = {
        total_leads: revenueData.reduce((sum, item) => sum + item.lead_count, 0),
        total_revenue: revenueData.reduce((sum, item) => sum + item.total_revenue, 0),
        avg_bid: revenueData.reduce((sum, item) => sum + item.total_revenue, 0) / 
                 Math.max(1, revenueData.reduce((sum, item) => sum + item.lead_count, 0))
      };
      
      return NextResponse.json({
        success: true,
        data: revenueData,
        summary: overallData,
        method: 'direct-count'
      });
    }
    
    console.log('Successfully counted leads by list ID');
    
    // STEP 3: Calculate revenue for each list ID
    const revenueData = listRoutings
      .filter(routing => routing.active)
      .map(routing => {
        const leadCount = leadsByListId?.find((item: any) => item.list_id === routing.list_id)?.count || 0;
        const totalRevenue = routing.bid * leadCount;
        
        return {
          list_id: routing.list_id,
          description: routing.description || routing.list_id,
          campaign_id: routing.campaign_id,
          bid_amount: routing.bid,
          lead_count: leadCount,
          total_revenue: totalRevenue
        };
      })
      .sort((a, b) => b.lead_count - a.lead_count);
    
    // Calculate overall totals
    const overallData = {
      total_leads: revenueData.reduce((sum, item) => sum + item.lead_count, 0),
      total_revenue: revenueData.reduce((sum, item) => sum + item.total_revenue, 0),
      avg_bid: revenueData.reduce((sum, item) => sum + item.total_revenue, 0) / 
               Math.max(1, revenueData.reduce((sum, item) => sum + item.lead_count, 0))
    };
    
    return NextResponse.json({
      success: true,
      data: revenueData,
      summary: overallData,
      method: 'sql-query'
    });
  } catch (error: any) {
    console.error('Error in total revenue API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
}
