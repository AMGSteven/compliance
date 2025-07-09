import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    console.log('Starting paginated lead count...');
    
    let allLeads: any[] = [];
    let rangeStart = 0;
    const pageSize = 1000;
    let hasMore = true;
    let totalFetched = 0;
    
    while (hasMore) {
      console.log(`Fetching records ${rangeStart} to ${rangeStart + pageSize - 1}...`);
      
      const { data: leads, error } = await supabase
        .from('leads')
        .select('list_id')
        .not('list_id', 'is', null)
        .range(rangeStart, rangeStart + pageSize - 1);
      
      if (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ success: false, error: error.message });
      }
      
      if (leads && leads.length > 0) {
        allLeads = allLeads.concat(leads);
        totalFetched += leads.length;
        hasMore = leads.length === pageSize; // Continue if we got a full page
        rangeStart += pageSize;
        
        console.log(`Fetched ${leads.length} records, total so far: ${totalFetched}`);
        
        // Safety break to avoid infinite loops
        if (totalFetched > 200000) {
          console.log('Reached safety limit of 200k records');
          break;
        }
      } else {
        hasMore = false;
        console.log('No more records found');
      }
    }
    
    console.log(`Finished fetching. Total records: ${totalFetched}`);
    
    // Count leads by list_id
    const listIdCounts: Record<string, number> = {};
    allLeads.forEach(lead => {
      if (lead.list_id) {
        listIdCounts[lead.list_id] = (listIdCounts[lead.list_id] || 0) + 1;
      }
    });
    
    // Convert to array and sort by count (descending)
    const sortedCounts = Object.entries(listIdCounts)
      .map(([list_id, count]) => ({ list_id, count }))
      .sort((a, b) => b.count - a.count);
    
    console.log(`Found ${sortedCounts.length} unique list_ids`);
    
    return NextResponse.json({
      success: true,
      total_leads: totalFetched,
      unique_list_ids: sortedCounts.length,
      counts_by_list_id: sortedCounts
    });
    
  } catch (error: any) {
    console.error('Error in paginated lead counts API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
