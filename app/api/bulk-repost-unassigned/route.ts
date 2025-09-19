import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Bulk re-post unassigned leads to internal dialer
 * POST /api/bulk-repost-unassigned
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting bulk re-posting of unassigned leads to internal dialer...');

    const supabase = createServerClient();

    // Get all unassigned leads from this week that can go to Internal Dialer
    const { data: leadsData, error: fetchError } = await supabase
      .from('leads')
      .select(`
        id, first_name, last_name, email, phone, address, city, state, zip_code,
        source, trusted_form_cert_url, transaction_id, income_bracket, birth_date,
        homeowner_status, custom_fields, list_id, campaign_id
      `)
      .eq('assigned_dialer_type', 1) // Recently assigned to Internal Dialer
      .gte('created_at', '2025-09-15T00:00:00Z') // This week
      .lt('created_at', '2025-09-20T00:00:00Z')
      .in('status', ['new', 'success'])
      .in('state', ['AL', 'AR', 'AZ', 'GA', 'IN', 'KY', 'LA', 'ME', 'MI', 'MO', 'MS', 'NC', 'NM', 'OH', 'PA', 'SC', 'TN', 'VA', 'WV'])
      .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Updated in last 10 minutes

    if (fetchError) {
      console.error('❌ Error fetching leads:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch leads: ${fetchError.message}`
      }, { status: 500 });
    }

    // Get routing information separately
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('list_id, campaign_id, cadence_id, token, description, vertical')
      .eq('active', true);

    if (routingError) {
      console.error('❌ Error fetching routing data:', routingError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch routing data: ${routingError.message}`
      }, { status: 500 });
    }

    // Combine leads with routing data
    const routingMap = new Map(routingData?.map(r => [r.list_id, r]) || []);
    const unassignedLeads = leadsData?.map(lead => ({
      ...lead,
      routing: routingMap.get(lead.list_id)
    })).filter(lead => lead.routing) || [];

    if (fetchError) {
      console.error('❌ Error fetching unassigned leads:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch leads: ${fetchError.message}`
      }, { status: 500 });
    }

    if (!unassignedLeads || unassignedLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unassigned leads found to re-post',
        processed: 0,
        successful: 0,
        failed: 0
      });
    }

    console.log(`📊 Found ${unassignedLeads.length} unassigned leads to re-post to internal dialer`);

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

      // Process leads in batches of 10 to avoid overwhelming the dialer API
      const batchSize = 10;
      for (let i = 0; i < unassignedLeads.length; i += batchSize) {
        const batch = unassignedLeads.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(unassignedLeads.length / batchSize)}`);

        // Process batch in parallel
        const batchPromises = batch.map(async (lead: any) => {
          try {
            const routing = lead.routing;
          
          // Format phone number
          const formattedPhone = lead.phone.startsWith('+1') ? lead.phone : `+1${lead.phone.replace(/\D/g, '')}`;

          // Create dialer payload
          const dialerPayload = {
            first_name: lead.first_name,
            last_name: lead.last_name,
            email: lead.email,
            phone: formattedPhone,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            zip_code: lead.zip_code,
            source: lead.source,
            trusted_form_cert_url: lead.trusted_form_cert_url,
            transaction_id: lead.transaction_id,
            income_bracket: lead.income_bracket,
            dob: lead.birth_date || '',
            homeowner_status: lead.homeowner_status,
            custom_fields: lead.custom_fields,
            list_id: lead.list_id,
            campaign_id: routing.campaign_id,
            cadence_id: routing.cadence_id,
            compliance_lead_id: lead.id
          };

          // Construct dialer API URL
          const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
          dialerUrl.searchParams.append('list_id', lead.list_id);
          dialerUrl.searchParams.append('campaign_id', routing.campaign_id);
          dialerUrl.searchParams.append('cadence_id', routing.cadence_id);
          dialerUrl.searchParams.append('token', routing.token);

          // Post to internal dialer
          const response = await fetch(dialerUrl.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dialerPayload),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dialer API error (${response.status}): ${errorText}`);
          }

          console.log(`✅ Successfully posted lead ${lead.id} to internal dialer`);
          return { success: true, leadId: lead.id };

        } catch (error) {
          console.error(`❌ Failed to post lead ${lead.id}:`, error);
          return { 
            success: false, 
            leadId: lead.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Update counters
      successful += batchResults.filter(r => r.success).length;
      failed += batchResults.filter(r => !r.success).length;
      
      // Collect errors
      batchResults
        .filter(r => !r.success)
        .forEach(r => errors.push(`Lead ${r.leadId}: ${r.error}`));

      // Small delay between batches
      if (i + batchSize < unassignedLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎯 Bulk re-posting completed: ${successful}/${unassignedLeads.length} successful in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: `Bulk re-posting completed: ${successful}/${unassignedLeads.length} leads posted to internal dialer`,
      processed: unassignedLeads.length,
      successful,
      failed,
      errors: errors.slice(0, 10), // Limit error details
      performance: {
        total_time_ms: totalTime,
        avg_time_per_lead_ms: Math.round(totalTime / unassignedLeads.length),
        throughput_leads_per_second: Math.round(unassignedLeads.length / (totalTime / 1000))
      }
    });

  } catch (error) {
    console.error('❌ Error in bulk re-posting:', error);
    return NextResponse.json({
      success: false,
      error: `Bulk re-posting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * Get status of unassigned leads that need re-posting
 * GET /api/bulk-repost-unassigned
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Count unassigned leads by state eligibility
    const { data: stateBreakdown, error } = await supabase
      .from('leads')
      .select(`
        state,
        list_routings!inner(vertical)
      `)
      .eq('assigned_dialer_type', 1) // Recently assigned
      .gte('created_at', '2025-09-15T00:00:00Z')
      .lt('created_at', '2025-09-20T00:00:00Z')
      .in('status', ['new', 'success']);

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Failed to get status: ${error.message}`
      }, { status: 500 });
    }

    const allowedStates = ['AL', 'AR', 'AZ', 'GA', 'IN', 'KY', 'LA', 'ME', 'MI', 'MO', 'MS', 'NC', 'NM', 'OH', 'PA', 'SC', 'TN', 'VA', 'WV'];
    
    const allowedCount = stateBreakdown?.filter(lead => 
      allowedStates.includes((lead as any).state)
    ).length || 0;

    const restrictedCount = stateBreakdown?.filter(lead => 
      !allowedStates.includes((lead as any).state)
    ).length || 0;

    return NextResponse.json({
      success: true,
      data: {
        total_recently_assigned: stateBreakdown?.length || 0,
        allowed_state_leads: allowedCount,
        restricted_state_leads: restrictedCount,
        ready_for_posting: allowedCount > 0
      }
    });

  } catch (error) {
    console.error('❌ Error checking status:', error);
    return NextResponse.json({
      success: false,
      error: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
