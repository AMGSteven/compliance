import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('Getting lead counts by list_id using SQL aggregation...');
    const supabase = createServerClient();
    
    // Use SQL to count leads grouped by list_id
    const { data, error } = await supabase.rpc('count_leads_by_list_id');
    
    if (error) {
      console.error('RPC error, falling back to direct query:', error);
      
      // Fallback: try a simple aggregation query
      const { data: countData, error: countError } = await supabase
        .from('leads')
        .select('list_id')
        .not('list_id', 'is', null);
      
      if (countError) {
        console.error('Direct query error:', countError);
        return NextResponse.json({ success: false, error: countError.message });
      }
      
      // Count manually (this will be limited to 1000 but shows structure)
      const counts: Record<string, number> = {};
      countData.forEach(lead => {
        if (lead.list_id) {
          counts[lead.list_id] = (counts[lead.list_id] || 0) + 1;
        }
      });
      
      const sortedCounts = Object.entries(counts)
        .map(([list_id, count]) => ({ list_id, count }))
        .sort((a, b) => b.count - a.count);
      
      return NextResponse.json({
        success: true,
        message: 'Using fallback method (limited to 1000 records)',
        total_leads: countData.length,
        unique_list_ids: sortedCounts.length,
        counts_by_list_id: sortedCounts
      });
    }
    
    // If RPC worked, format the results
    const sortedCounts = data
      .map((row: any) => ({ list_id: row.list_id, count: row.count }))
      .sort((a: any, b: any) => b.count - a.count);
    
    const totalLeads = data.reduce((sum: number, row: any) => sum + row.count, 0);
    
    return NextResponse.json({
      success: true,
      total_leads: totalLeads,
      unique_list_ids: sortedCounts.length,
      counts_by_list_id: sortedCounts
    });
  } catch (error: any) {
    console.error('Error in lead counts API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
