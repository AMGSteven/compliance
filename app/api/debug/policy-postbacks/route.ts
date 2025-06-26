import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const url = new URL(request.url);
    const date = url.searchParams.get('date'); // Expected format: YYYY-MM-DD
    
    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required (format: YYYY-MM-DD)' }, { status: 400 });
    }
    
    // Query policy_postbacks table for the specified date
    const startTimestamp = `${date}T00:00:00-05:00`; // EST timezone
    const endTimestamp = `${date}T23:59:59-05:00`;
    
    const { data: postbacks, error: postbacksError } = await supabase
      .from('policy_postbacks')
      .select('*')
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp)
      .order('created_at', { ascending: false });
    
    if (postbacksError) {
      console.error('Error fetching policy postbacks:', postbacksError);
      return NextResponse.json({ error: postbacksError.message }, { status: 500 });
    }
    
    // Also check leads table for comparison
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, policy_status, policy_postback_date')
      .eq('policy_status', 'issued')
      .gte('policy_postback_date', startTimestamp)
      .lte('policy_postback_date', endTimestamp)
      .order('policy_postback_date', { ascending: false });
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }
    
    return NextResponse.json({
      date: date,
      postbacks: {
        count: postbacks?.length || 0,
        data: postbacks || []
      },
      leads: {
        count: leads?.length || 0,
        data: leads || []
      },
      summary: {
        postbacksRecorded: postbacks?.length || 0,
        leadsWithPostbackDate: leads?.length || 0,
        discrepancy: (postbacks?.length || 0) - (leads?.length || 0)
      }
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
}
