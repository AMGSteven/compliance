import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RepostProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  completed: boolean;
  estimated_time_remaining?: string;
}

interface MismatchData {
  list_id: string;
  description: string;
  lead_campaign_id: string;
  routing_campaign_id: string;
  routing_cadence_id: string;
  token: string;
  affected_leads: number;
  total_internal_leads: number;
  mismatch_percentage: number;
}

/**
 * Enterprise-grade lead re-posting with optimized batch processing
 * POST /api/repost-leads
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      list_id, 
      batch_size = 50 // Optimized batch size for enterprise processing
    } = body;

    if (!list_id) {
      return NextResponse.json({
        success: false,
        error: 'list_id parameter is required'
      }, { status: 400 });
    }

    console.log(`🚀 [ENTERPRISE] Starting optimized lead re-posting for list_id: ${list_id}`);
    console.log(`📦 Batch size: ${batch_size}`);

    const supabase = createServerClient();

    // Get routing information using optimized query
    const { data: routing, error: routingError } = await supabase
      .from('list_routings')
      .select('campaign_id, cadence_id, description, token')
      .eq('list_id', list_id)
      .eq('active', true)
      .single();

    if (routingError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch routing info: ${routingError.message}`
      }, { status: 500 });
    }

    console.log(`✅ Found routing: ${routing.description}`);
    console.log(`📝 Correct campaign_id: ${routing.campaign_id}`);

    const progress: RepostProgress = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      completed: false
    };

    let offset = 0;
    const limit = batch_size;
    let hasMoreLeads = true;

    while (hasMoreLeads) {
      // Use RPC function to get batch of leads efficiently
      const { data: leadsBatch, error: leadsError } = await supabase.rpc('get_leads_for_repost', {
        p_list_id: list_id,
        p_correct_campaign_id: routing.campaign_id,
        p_limit: limit,
        p_offset: offset
      });

      if (leadsError) {
        console.error('❌ Error fetching leads batch:', leadsError);
        progress.errors.push(`Failed to fetch leads: ${leadsError.message}`);
        break;
      }

      if (!leadsBatch || leadsBatch.length === 0) {
        hasMoreLeads = false;
        break;
      }

      // Set total on first batch
      if (progress.total === 0) {
        // Get total count efficiently
        const { count: totalCount } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('list_id', list_id)
          .eq('assigned_dialer_type', 1)
          .neq('campaign_id', routing.campaign_id);
        
        progress.total = totalCount || 0;
        console.log(`📊 Total leads to re-post: ${progress.total}`);
      }

      console.log(`🔄 Processing batch ${Math.floor(offset / limit) + 1} (${leadsBatch.length} leads)`);

      // Process leads in parallel batches for maximum efficiency
      const batchPromises = leadsBatch.map(async (lead: any) => {
        try {
          // Format phone number efficiently
          const formattedPhone = lead.phone.startsWith('+1') ? lead.phone : `+1${lead.phone.replace(/\D/g, '')}`;

          // Create optimized dialer payload
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
            list_id: list_id,
            campaign_id: routing.campaign_id, // Corrected campaign_id
            cadence_id: routing.cadence_id,
            compliance_lead_id: lead.id
          };

          // Construct dialer API URL
          const dialerUrl = new URL('https://dialer.juicedmedia.io/api/webhooks/lead-postback');
          dialerUrl.searchParams.append('list_id', list_id);
          dialerUrl.searchParams.append('campaign_id', routing.campaign_id);
          dialerUrl.searchParams.append('cadence_id', routing.cadence_id);
          dialerUrl.searchParams.append('token', routing.token);

          // Post to internal dialer API with timeout
          const dialerResponse = await fetch(dialerUrl.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dialerPayload),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (!dialerResponse.ok) {
            const errorText = await dialerResponse.text();
            throw new Error(`Dialer API error (${dialerResponse.status}): ${errorText}`);
          }

          const dialerResult = await dialerResponse.json();
          console.log(`✅ Re-posted lead ${lead.id} successfully`);

          return { success: true, leadId: lead.id };

        } catch (error) {
          console.error(`❌ Failed to re-post lead ${lead.id}:`, error);
          return { 
            success: false, 
            leadId: lead.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      // Wait for all leads in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Collect successful lead IDs for batch database update
      const successfulLeadIds = batchResults
        .filter(result => result.success)
        .map(result => result.leadId);

      // Batch update database using RPC function
      if (successfulLeadIds.length > 0) {
        const { data: updateResult, error: updateError } = await supabase.rpc('update_leads_for_repost_batch', {
          p_lead_ids: successfulLeadIds,
          p_new_campaign_id: routing.campaign_id
        });

        if (updateError) {
          console.error('❌ Batch update error:', updateError);
          progress.errors.push(`Batch update failed: ${updateError.message}`);
        } else {
          console.log(`✅ Batch updated ${successfulLeadIds.length} leads in database`);
        }
      }

      // Update progress
      progress.processed += leadsBatch.length;
      progress.successful += batchResults.filter(r => r.success).length;
      progress.failed += batchResults.filter(r => !r.success).length;
      
      // Add failed lead errors
      batchResults
        .filter(r => !r.success)
        .forEach(r => progress.errors.push(`Lead ${r.leadId}: ${r.error}`));

      // Calculate estimated time remaining
      const elapsed = Date.now() - startTime;
      const avgTimePerLead = elapsed / progress.processed;
      const remaining = progress.total - progress.processed;
      const estimatedMs = remaining * avgTimePerLead;
      progress.estimated_time_remaining = `${Math.round(estimatedMs / 1000)}s`;

      offset += limit;

      // Add small delay between batches to be respectful to external API
      if (hasMoreLeads && leadsBatch.length === limit) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
      }
    }

    progress.completed = true;
    const totalTime = Date.now() - startTime;

    console.log(`🎯 [ENTERPRISE] Re-posting completed in ${totalTime}ms: ${progress.successful}/${progress.total} successful`);

    return NextResponse.json({
      success: true,
      message: `Enterprise re-posting completed: ${progress.successful}/${progress.total} leads successfully re-posted in ${Math.round(totalTime/1000)}s`,
      progress,
      performance: {
        total_time_ms: totalTime,
        avg_time_per_lead_ms: Math.round(totalTime / progress.total),
        throughput_leads_per_second: Math.round(progress.total / (totalTime / 1000))
      }
    });

  } catch (error) {
    console.error('❌ [ENTERPRISE] Error in lead re-posting:', error);
    return NextResponse.json({
      success: false,
      error: `Enterprise re-posting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

/**
 * Enterprise-grade mismatch detection and status checking
 * GET /api/repost-leads?action=list_all - Get all lists with mismatches
 * GET /api/repost-leads?list_id=xxx - Check specific list
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const list_id = url.searchParams.get('list_id');
    const action = url.searchParams.get('action');

    const supabase = createServerClient();

    // Enterprise mismatch detection across all lists
    if (action === 'list_all') {
      console.log('🔍 [ENTERPRISE] Running comprehensive mismatch detection...');
      
      const { data: mismatches, error: mismatchError } = await supabase.rpc('get_campaign_mismatches');

      if (mismatchError) {
        console.error('❌ RPC mismatch detection failed:', mismatchError);
        return NextResponse.json({
          success: false,
          error: `Mismatch detection failed: ${mismatchError.message}`
        }, { status: 500 });
      }

      const totalAffectedLeads = mismatches?.reduce((sum: number, item: any) => sum + (item.affected_leads || 0), 0) || 0;

      console.log(`✅ [ENTERPRISE] Found ${mismatches?.length || 0} lists with mismatches affecting ${totalAffectedLeads} leads`);

      return NextResponse.json({
        success: true,
        data: mismatches || [],
        summary: {
          total_mismatched_lists: mismatches?.length || 0,
          total_affected_leads: totalAffectedLeads,
          scan_completed_at: new Date().toISOString()
        }
      });
    }

    // Single list analysis
    if (!list_id) {
      return NextResponse.json({
        success: false,
        error: 'list_id parameter is required (or use action=list_all to scan all lists)'
      }, { status: 400 });
    }

    console.log(`🔍 [ENTERPRISE] Analyzing list: ${list_id}`);

    // Get routing information
    const { data: routing, error: routingError } = await supabase
      .from('list_routings')
      .select('campaign_id, cadence_id, description, token, active, vertical')
      .eq('list_id', list_id)
      .eq('active', true)
      .single();

    if (routingError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch routing info: ${routingError.message}`
      }, { status: 500 });
    }

    // Get detailed mismatch breakdown using efficient query
    const { data: mismatchDetails, error: detailError } = await supabase
      .from('leads')
      .select('campaign_id, id.count()')
      .eq('list_id', list_id)
      .eq('assigned_dialer_type', 1)
      .neq('campaign_id', routing.campaign_id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (detailError) {
      console.error('❌ Error getting mismatch details:', detailError);
    }

    // Count total leads that should go to internal dialer (assigned + unassigned for internal dialer lists)
    const { count: totalCount, error: totalError } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', list_id)
      .or('assigned_dialer_type.eq.1,assigned_dialer_type.is.null');

    if (totalError) {
      console.error('❌ Error counting total leads:', totalError);
    }

    const needsRepostCount = mismatchDetails?.reduce((sum, item) => sum + ((item as any).count || 0), 0) || 0;

    const mismatchBreakdown = mismatchDetails?.map(item => ({
      incorrect_campaign_id: item.campaign_id,
      affected_leads: (item as any).count || 0
    })) || [];

    console.log(`✅ [ENTERPRISE] Analysis complete: ${needsRepostCount}/${totalCount || 0} leads need re-posting`);

    return NextResponse.json({
      success: true,
      data: {
        list_id,
        description: routing.description,
        vertical: routing.vertical,
        correct_campaign_id: routing.campaign_id,
        correct_cadence_id: routing.cadence_id,
        token: routing.token,
        total_internal_leads: totalCount || 0,
        needs_repost_count: needsRepostCount,
        ready_for_repost: needsRepostCount > 0,
        mismatch_breakdown: mismatchBreakdown,
        mismatch_percentage: totalCount ? Math.round((needsRepostCount / totalCount) * 100) : 0
      }
    });

  } catch (error) {
    console.error('❌ [ENTERPRISE] Error in status check:', error);
    return NextResponse.json({
      success: false,
      error: `Enterprise status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}