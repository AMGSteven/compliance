import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    
    console.log('Starting postback date fix...');
    
    // First, get all issued leads that need to be updated
    const { data: issuedLeads, error: fetchError } = await supabase
      .from('leads')
      .select('id, updated_at, created_at')
      .eq('policy_status', 'issued')
      .is('policy_postback_date', null);
    
    if (fetchError) {
      console.error('Error fetching issued leads:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    
    if (!issuedLeads || issuedLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads need updating',
        totalIssuedLeadsWithPostbackDates: 0
      });
    }
    
    console.log(`Found ${issuedLeads.length} leads to update`);
    
    // Update each lead with the appropriate postback date
    let updatedCount = 0;
    for (const lead of issuedLeads) {
      // Use updated_at if available, otherwise use created_at
      const postbackDate = lead.updated_at || lead.created_at;
      
      const { error: updateError } = await supabase
        .from('leads')
        .update({ policy_postback_date: postbackDate })
        .eq('id', lead.id);
      
      if (updateError) {
        console.error(`Error updating lead ${lead.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} leads`);
    
    return NextResponse.json({
      success: true,
      message: 'Postback dates updated successfully',
      totalLeadsUpdated: updatedCount,
      totalIssuedLeadsWithPostbackDates: updatedCount
    });
    
  } catch (error) {
    console.error('Error fixing postback dates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fix postback dates' },
      { status: 500 }
    );
  }
}
