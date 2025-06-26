import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Step 1: Check if policy_postbacks table has data
    const { data: postbackTableCheck, error: tableError } = await supabase
      .from('policy_postbacks')
      .select('lead_id, created_at')
      .limit(5);
    
    let updatedFromPostbackTable = 0;
    let updatedFromUpdatedAt = 0;
    
    if (!tableError && postbackTableCheck && postbackTableCheck.length > 0) {
      console.log('Found policy_postbacks table with data, using it for accurate dates...');
      
      // Method 1: Use policy_postbacks table for most accurate dates
      const { data: allPostbacks, error: postbacksError } = await supabase
        .from('policy_postbacks')
        .select('lead_id, created_at')
        .order('created_at', { ascending: false });
      
      if (postbacksError) {
        throw postbacksError;
      }
      
      if (allPostbacks && allPostbacks.length > 0) {
        // Group by lead_id and get the latest postback date for each lead
        const latestPostbacks = new Map();
        allPostbacks.forEach(postback => {
          if (!latestPostbacks.has(postback.lead_id) || 
              new Date(postback.created_at) > new Date(latestPostbacks.get(postback.lead_id))) {
            latestPostbacks.set(postback.lead_id, postback.created_at);
          }
        });
        
        // Update leads with accurate postback dates
        for (const [leadId, postbackDate] of latestPostbacks) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ policy_postback_date: postbackDate })
            .eq('id', leadId)
            .eq('policy_status', 'issued');
          
          if (!updateError) {
            updatedFromPostbackTable++;
          }
        }
        
        console.log(`Updated ${updatedFromPostbackTable} leads from policy_postbacks table`);
      }
    }
    
    // Step 2: For leads not covered by policy_postbacks table, 
    // use updated_at if it's significantly different from created_at (indicating a postback was received)
    const { data: remainingLeads, error: remainingError } = await supabase
      .from('leads')
      .select('id, created_at, updated_at, policy_postback_date')
      .eq('policy_status', 'issued');
    
    if (remainingError) {
      throw remainingError;
    }
    
    if (remainingLeads && remainingLeads.length > 0) {
      for (const lead of remainingLeads) {
        const createdTime = new Date(lead.created_at).getTime();
        const updatedTime = new Date(lead.updated_at).getTime();
        const currentPostbackTime = new Date(lead.policy_postback_date).getTime();
        
        // If updated_at is different from created_at AND current postback_date equals created_at,
        // then use updated_at as the postback received date
        if (Math.abs(updatedTime - createdTime) > 1000 && // More than 1 second difference
            Math.abs(currentPostbackTime - createdTime) < 1000) { // Current postback date is basically created_at
          
          const { error: updateError } = await supabase
            .from('leads')
            .update({ policy_postback_date: lead.updated_at })
            .eq('id', lead.id);
          
          if (!updateError) {
            updatedFromUpdatedAt++;
          }
        }
      }
      
      console.log(`Updated ${updatedFromUpdatedAt} additional leads using updated_at`);
    }
    
    // Step 3: Get summary of results
    const { data: dateDistribution, error: distError } = await supabase
      .from('leads')
      .select('policy_postback_date')
      .eq('policy_status', 'issued');
    
    if (distError) {
      throw distError;
    }
    
    // Group by date to show distribution
    const dateGroups: Record<string, number> = {};
    if (dateDistribution) {
      dateDistribution.forEach(lead => {
        const date = lead.policy_postback_date.split('T')[0]; // Get YYYY-MM-DD
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'All historical postback dates have been corrected',
      updated_from_postback_table: updatedFromPostbackTable,
      updated_from_updated_at: updatedFromUpdatedAt,
      total_updated: updatedFromPostbackTable + updatedFromUpdatedAt,
      date_distribution: Object.entries(dateGroups)
        .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending
        .slice(0, 10) // Show last 10 days
        .reduce((acc: Record<string, number>, [date, count]) => {
          acc[date] = count;
          return acc;
        }, {})
    });
    
  } catch (error) {
    console.error('Error fixing all postback dates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fix all postback dates: ' + (error as Error).message 
      },
      { status: 500 }
    );
  }
}
