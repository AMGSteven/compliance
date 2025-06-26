import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Query 1: Total issued leads
    const { count: totalIssued, error: totalError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('policy_status', 'issued');
    
    if (totalError) {
      throw totalError;
    }
    
    // Query 2: Issued leads with today's postback date
    const { count: todayPostbacks, error: todayError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('policy_status', 'issued')
      .gte('policy_postback_date', `${today}T00:00:00Z`)
      .lte('policy_postback_date', `${today}T23:59:59Z`);
    
    if (todayError) {
      throw todayError;
    }
    
    // Query 3: Sample of leads without today's postback date
    const { data: missingDateLeads, error: missingError } = await supabase
      .from('leads')
      .select('id, policy_status, policy_postback_date, created_at, updated_at')
      .eq('policy_status', 'issued')
      .not('policy_postback_date', 'gte', `${today}T00:00:00Z`)
      .limit(10);
    
    if (missingError) {
      throw missingError;
    }
    
    // Query 4: Check policy_postbacks table for today's entries
    const { count: postbackTableCount, error: postbackTableError } = await supabase
      .from('policy_postbacks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);
    
    // Don't throw error if table doesn't exist, just set to null
    const actualPostbackTableCount = postbackTableError ? null : postbackTableCount;
    
    return NextResponse.json({
      success: true,
      today: today,
      data: {
        total_issued_leads: totalIssued,
        today_postback_date_leads: todayPostbacks,
        missing_today_count: (totalIssued || 0) - (todayPostbacks || 0),
        policy_postbacks_table_today: actualPostbackTableCount,
        sample_missing_leads: missingDateLeads
      }
    });
    
  } catch (error) {
    console.error('Error querying postback dates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to query postback dates: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
