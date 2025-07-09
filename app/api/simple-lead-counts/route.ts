import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    console.log('Getting simple lead counts with aggregation...');
    
    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .not('list_id', 'is', null);
    
    if (countError) {
      console.error('Count error:', countError);
    } else {
      console.log('Total leads with list_id:', totalCount);
    }
    
    // Try to get distinct list_ids first
    const { data: distinctListIds, error: distinctError } = await supabase
      .from('leads')
      .select('list_id')
      .not('list_id', 'is', null)
      .limit(1000000);
    
    if (distinctError) {
      console.error('Error getting distinct list_ids:', distinctError);
      return NextResponse.json({ success: false, error: distinctError.message });
    }
    
    // Manually count occurrences
    const counts: Record<string, number> = {};
    distinctListIds?.forEach(lead => {
      if (lead.list_id) {
        counts[lead.list_id] = (counts[lead.list_id] || 0) + 1;
      }
    });
    
    const sortedCounts = Object.entries(counts)
      .map(([list_id, count]) => ({ list_id, count }))
      .sort((a, b) => b.count - a.count);
    
    console.log('Processed', distinctListIds?.length, 'records');
    console.log('Found', sortedCounts.length, 'unique list_ids');
    
    return NextResponse.json({
      success: true,
      total_processed: distinctListIds?.length || 0,
      actual_total_count: totalCount,
      unique_list_ids: sortedCounts.length,
      counts_by_list_id: sortedCounts,
      note: distinctListIds?.length === 1000 ? 'Results may be limited to 1000 records due to Supabase limits' : 'Complete results'
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}
