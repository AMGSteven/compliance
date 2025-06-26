import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Find leads created on 6/16 that have today's (6/17) postback date
    const { data: yesterdayLeads, error: yesterdayError } = await supabase
      .from('leads')
      .select('id, created_at, policy_postback_date')
      .eq('policy_status', 'issued')
      .gte('created_at', '2025-06-16T00:00:00Z')
      .lte('created_at', '2025-06-16T23:59:59Z')
      .gte('policy_postback_date', '2025-06-17T00:00:00Z'); // Has today's date
    
    if (yesterdayError) {
      throw yesterdayError;
    }
    
    if (!yesterdayLeads || yesterdayLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads from 6/16 need correction',
        corrected_count: 0
      });
    }
    
    // Update these leads to have 6/16 as their postback date
    // Use the end of 6/16 as the postback received time
    const june16PostbackDate = '2025-06-16T23:59:59Z';
    
    const leadIds = yesterdayLeads.map(lead => lead.id);
    
    const { error: updateError } = await supabase
      .from('leads')
      .update({ 
        policy_postback_date: june16PostbackDate
      })
      .in('id', leadIds);
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({
      success: true,
      message: `Corrected ${yesterdayLeads.length} leads from 6/16 to have correct postback date`,
      corrected_count: yesterdayLeads.length,
      corrected_lead_ids: leadIds,
      new_postback_date: june16PostbackDate,
      details: yesterdayLeads.map(lead => ({
        lead_id: lead.id.substring(0, 8) + '...',
        created_on: lead.created_at.split('T')[0],
        old_postback_date: lead.policy_postback_date.split('T')[0],
        new_postback_date: june16PostbackDate.split('T')[0]
      }))
    });
    
  } catch (error) {
    console.error('Error fixing yesterday postbacks:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fix yesterday postbacks: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
