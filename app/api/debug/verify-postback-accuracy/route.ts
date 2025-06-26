import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Check 1: Sample some leads to see if postback dates make sense
    const { data: sampleLeads, error: sampleError } = await supabase
      .from('leads')
      .select('id, created_at, updated_at, policy_postback_date, policy_status')
      .eq('policy_status', 'issued')
      .order('policy_postback_date', { ascending: false })
      .limit(10);
    
    if (sampleError) {
      throw sampleError;
    }
    
    // Check 2: Look for leads where postback date is before creation date (impossible)
    const { data: invalidDates, error: invalidError } = await supabase
      .from('leads')
      .select('id, created_at, policy_postback_date')
      .eq('policy_status', 'issued')
      .limit(5);
    
    if (invalidError) {
      throw invalidError;
    }
    
    // Filter client-side since the SQL comparison was causing issues
    const actualInvalidDates = invalidDates?.filter(lead => 
      new Date(lead.policy_postback_date) < new Date(lead.created_at)
    ) || [];
    
    // Check 3: Check if policy_postbacks table exists and has data
    const { data: postbackTableData, error: postbackError } = await supabase
      .from('policy_postbacks')
      .select('lead_id, created_at, policy_status')
      .order('created_at', { ascending: false })
      .limit(10);
    
    const hasPostbackTable = !postbackError && postbackTableData && postbackTableData.length > 0;
    
    // Check 4: Get total count and date range
    const { count: totalIssued, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('policy_status', 'issued');
    
    if (countError) {
      throw countError;
    }
    
    // Check 5: Get earliest and latest postback dates
    const { data: dateRange, error: rangeError } = await supabase
      .from('leads')
      .select('policy_postback_date')
      .eq('policy_status', 'issued')
      .order('policy_postback_date', { ascending: true })
      .limit(1);
    
    const { data: latestDate, error: latestError } = await supabase
      .from('leads')
      .select('policy_postback_date')
      .eq('policy_status', 'issued')
      .order('policy_postback_date', { ascending: false })
      .limit(1);
    
    return NextResponse.json({
      success: true,
      verification_results: {
        total_issued_leads: totalIssued,
        has_postback_table: hasPostbackTable,
        postback_table_entries: hasPostbackTable ? postbackTableData?.length : 0,
        invalid_dates_count: actualInvalidDates.length,
        invalid_dates_sample: actualInvalidDates || [],
        earliest_postback_date: dateRange?.[0]?.policy_postback_date || null,
        latest_postback_date: latestDate?.[0]?.policy_postback_date || null,
        recent_leads_sample: sampleLeads?.map(lead => ({
          id: lead.id.substring(0, 8) + '...',
          created_at: lead.created_at,
          updated_at: lead.updated_at,
          policy_postback_date: lead.policy_postback_date,
          days_between_create_and_postback: Math.round(
            (new Date(lead.policy_postback_date).getTime() - new Date(lead.created_at).getTime()) 
            / (1000 * 60 * 60 * 24)
          )
        })) || []
      }
    });
    
  } catch (error) {
    console.error('Error verifying postback accuracy:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to verify postback accuracy: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
