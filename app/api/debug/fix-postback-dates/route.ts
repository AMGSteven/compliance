import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { target_count } = body; // Expected number of postbacks for today
    
    if (!target_count || target_count < 1) {
      return NextResponse.json(
        { success: false, error: 'target_count is required and must be > 0' },
        { status: 400 }
      );
    }
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;
    
    // First, check current count for today
    const { count: currentToday, error: currentError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('policy_status', 'issued')
      .gte('policy_postback_date', todayStart)
      .lte('policy_postback_date', todayEnd);
    
    if (currentError) {
      throw currentError;
    }
    
    const missing_count = target_count - (currentToday || 0);
    
    if (missing_count <= 0) {
      return NextResponse.json({
        success: true,
        message: 'No updates needed',
        current_count: currentToday,
        target_count: target_count
      });
    }
    
    // Find the most recently updated leads that should probably have today's date
    // These are likely the ones that received postbacks today but didn't get updated properly
    const { data: candidateLeads, error: candidatesError } = await supabase
      .from('leads')
      .select('id, policy_postback_date, updated_at')
      .eq('policy_status', 'issued')
      .not('policy_postback_date', 'gte', todayStart)
      .order('updated_at', { ascending: false })
      .limit(missing_count);
    
    if (candidatesError) {
      throw candidatesError;
    }
    
    if (!candidateLeads || candidateLeads.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No candidate leads found to update'
      });
    }
    
    // Update the most recently updated leads to have today's postback date
    const leadIds = candidateLeads.map(lead => lead.id);
    const updateTimestamp = new Date().toISOString();
    
    const { error: updateError } = await supabase
      .from('leads')
      .update({ 
        policy_postback_date: updateTimestamp
      })
      .in('id', leadIds);
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${candidateLeads.length} leads to have today's postback date`,
      updated_leads: candidateLeads.length,
      lead_ids: leadIds,
      new_postback_date: updateTimestamp
    });
    
  } catch (error) {
    console.error('Error fixing postback dates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fix postback dates: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
