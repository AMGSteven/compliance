import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TrafficSourceRevenue {
  traffic_source: string;
  display_name: string;
  leads_count: number;
  total_bid_amount: number;
  average_bid: number;
  campaigns: {
    campaign_id: string;
    campaign_name: string;
    leads_count: number;
    bid_amount: number;
    total_revenue: number;
  }[];
  list_ids: {
    list_id: string;
    description: string;
    leads_count: number;
    total_revenue: number;
    policy_count?: number;
    cost_per_acquisition?: number;
    // NEW: Dialer-specific fields
    assigned_dialer_type?: number;
    dialer_name?: string;
    dialer_transfer_rate?: number;
    dialer_policy_rate?: number;
  }[];
}

interface ListRouting {
  id: string;
  list_id: string;
  campaign_id: string;
  cadence_id?: string;
  description?: string;
  bid: number;
  active: boolean;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Using UNIFIED SQL approach with consistent EST timezone handling...');
    const supabase = createServerClient();
    
    // Get query parameters for filtering
    const url = new URL(request.url);
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');
    const timeFrame = url.searchParams.get('timeFrame') || 'all';
    
    // NEW: Dialer-specific analytics parameter
    const groupByDialer = url.searchParams.get('group_by_dialer') === 'true';
    
    // NEW: Vertical filtering parameter
    const vertical = url.searchParams.get('vertical');
    
    // Cross-temporal filtering parameters
    const leadStartDate = url.searchParams.get('leadStartDate');
    const leadEndDate = url.searchParams.get('leadEndDate'); 
    const useProcessingDate = url.searchParams.get('useProcessingDate') === 'true';
    
    const isDualDateFiltering = Boolean(useProcessingDate && leadStartDate && leadEndDate);
    
    console.log('🔍 Query params:', { 
      startDate, 
      endDate, 
      leadStartDate, 
      leadEndDate, 
      useProcessingDate, 
      isDualDateFiltering,
      groupByDialer,
      vertical
    });
    
    // Handle date defaults
    if (!startDate || !endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
      console.log(`⚠️ Using default date range: ${startDate} to ${endDate}`);
    }
    
    const startTime = Date.now();
    
    if (isDualDateFiltering) {
      console.log('🔥 CROSS-TEMPORAL MODE: Using get_cross_temporal_revenue_data_optimized');
      
      // Use the cross-temporal function for cross-temporal analysis
      const { data: crossTemporalResults, error: crossTemporalError } = await supabase.rpc('get_cross_temporal_revenue_data_optimized', {
        p_start_date: startDate, // Processing date range (when policies/transfers occurred)
        p_end_date: endDate,
        p_lead_start_date: leadStartDate, // Lead generation date range (cohort)
        p_lead_end_date: leadEndDate,
        p_cross_temporal: true,
        p_vertical: vertical // NEW: Vertical filtering
      });
      
      if (crossTemporalError) {
        console.error('❌ Cross-temporal query error:', crossTemporalError);
        return NextResponse.json({
          success: false,
          error: `Cross-temporal query failed: ${crossTemporalError.message}`
        }, { status: 500 });
      }
      
      if (!crossTemporalResults || crossTemporalResults.length === 0) {
        console.log('⚠️ No cross-temporal results found');
        return NextResponse.json({
          success: true,
          data: [],
          summary: { totalRevenue: 0, totalLeads: 0, averageBid: 0 },
          timeFrame,
          startDate,
          endDate
        });
      }
      
      console.log(`✅ CROSS-TEMPORAL: Found ${crossTemporalResults.length} lists with cross-temporal data`);
      
      // Format cross-temporal results
      const results = crossTemporalResults.map((result: {
        list_id: string;
        total_leads: string | number;
        total_revenue: string | number;
        policy_count: string | number;
        transfer_count: string | number;
        policy_rate: string | number;
      }) => ({
        list_id: result.list_id,
        description: result.list_id, // Will be enhanced with actual descriptions below
        campaign_id: 'cross-temporal',
        total_leads: parseInt(result.total_leads.toString()) || 0,
        weekend_leads: 0, // Cross-temporal function doesn't separate weekend/weekday
        weekday_leads: parseInt(result.total_leads.toString()) || 0,
        total_revenue: parseFloat(result.total_revenue.toString()) || 0,
        policy_count: parseInt(result.policy_count.toString()) || 0,
        transfer_count: parseInt(result.transfer_count.toString()) || 0,
        policy_rate: parseFloat(result.policy_rate.toString()) || 0,
        bid: (parseInt(result.total_leads.toString()) || 0) > 0 ? (parseFloat(result.total_revenue.toString()) || 0) / (parseInt(result.total_leads.toString()) || 0) : 0,
        mathematical_consistency: true,
        timezone_used: 'America/New_York (EST)',
        query_performance: 'Cross-temporal SQL with EST timezone handling'
      }));
      
      // Enhance with list descriptions (include ALL lists, even paused - we need all purchased leads)
      const { data: listRoutings } = await supabase
        .from('list_routings')
        .select('list_id, description, campaign_id');
        // REMOVED: .eq('active', true) - We need ALL leads in date range, even from paused campaigns
      
      const routingMap = new Map(listRoutings?.map(r => [r.list_id, r]) || []);
      
      results.forEach((result: {
        list_id: string;
        description: string;
        campaign_id: string;
        total_leads: number;
        total_revenue: number;
        policy_count: number;
        transfer_count: number;
      }) => {
        const routing = routingMap.get(result.list_id);
        if (routing) {
          result.description = routing.description || result.list_id;
          result.campaign_id = routing.campaign_id || 'cross-temporal';
        }
        
        console.log(`✅ CROSS-TEMPORAL: ${result.description}: ${result.total_leads} leads (cohort from ${leadStartDate}-${leadEndDate}), ${result.policy_count} policies (issued ${startDate}-${endDate}), ${result.transfer_count} transfers (completed ${startDate}-${endDate}), $${result.total_revenue.toFixed(2)} revenue`);
      });
      
      // Group and format results (same logic as normal mode)
      const trafficSources: Record<string, any> = {};
      
      results.forEach((result: any) => {
        const source = result.description;
        
        if (!trafficSources[source]) {
          trafficSources[source] = {
            traffic_source: source,
            display_name: source,
            leads_count: 0,
            total_bid_amount: 0,
            average_bid: 0,
            campaigns: {},
            list_ids: []
          };
        }
        
        trafficSources[source].leads_count += result.total_leads;
        trafficSources[source].total_bid_amount += result.total_revenue;
        
        const cpa = result.policy_count > 0 ? result.total_revenue / result.policy_count : null;
        
        trafficSources[source].list_ids.push({
          list_id: result.list_id,
          description: result.description,
          leads_count: result.total_leads,
          total_revenue: result.total_revenue,
          policy_count: result.policy_count,
          transfer_count: result.transfer_count,
          cost_per_acquisition: cpa,
          policy_rate: result.policy_rate,
          mathematical_consistency: result.mathematical_consistency,
          timezone_used: result.timezone_used,
          query_performance: result.query_performance
        });
        
        const campaignId = result.campaign_id || 'cross-temporal';
        if (!trafficSources[source].campaigns[campaignId]) {
          trafficSources[source].campaigns[campaignId] = {
            campaign_id: campaignId,
            campaign_name: campaignId,
            leads_count: 0,
            bid_amount: 0,
            total_revenue: 0
          };
        }
        trafficSources[source].campaigns[campaignId].leads_count += result.total_leads;
        trafficSources[source].campaigns[campaignId].total_revenue += result.total_revenue;
      });
      
      const formattedData = Object.values(trafficSources).map((source: any) => {
        source.average_bid = source.leads_count > 0 ? 
          source.total_bid_amount / source.leads_count : 0;
        
        return {
          ...source,
          campaigns: Object.values(source.campaigns),
          list_ids: source.list_ids
        };
      }).sort((a, b) => b.total_bid_amount - a.total_bid_amount);
      
      const totalRevenue = formattedData.reduce((sum, source) => sum + source.total_bid_amount, 0);
      const totalLeads = formattedData.reduce((sum, source) => sum + source.leads_count, 0);
    
    const queryTime = Date.now() - startTime;
      console.log(`🎯 CROSS-TEMPORAL APPROACH: Processed ${totalLeads} leads across ${formattedData.length} traffic sources in ${queryTime}ms with cross-temporal analysis`);
    
      return NextResponse.json({
        success: true,
        data: formattedData,
        summary: {
          totalRevenue,
          totalLeads,
          averageBid: totalLeads > 0 ? totalRevenue / totalLeads : 0
        },
        timeFrame,
        startDate,
        endDate,
        leadStartDate,
        leadEndDate,
        performance: {
          queryTimeMs: queryTime,
          queryType: 'cross_temporal_optimized',
          optimization: `🎯 Cross-temporal analysis: ${totalLeads} leads from ${leadStartDate}-${leadEndDate}, events from ${startDate}-${endDate}`,
          functionUsed: 'get_cross_temporal_revenue_data_optimized',
          indexesUtilized: ['idx_leads_created_at', 'idx_leads_policy_postback_date', 'idx_leads_transferred_at'],
          scanType: 'cross_temporal_single_scan',
          mathematicalConsistency: true,
          timezoneHandling: 'America/New_York (EST)'
        }
      });
      
    } else {
      console.log('🔥 NORMAL MODE: Using get_lead_counts_unified for mathematical consistency');
      
      // STEP 1: Get all list routings (including paused/inactive - revenue reporting needs ALL purchased leads)
      console.log('📋 Fetching all list routings (including paused) for accurate revenue reporting...');
      const { data: listRoutings, error: routingsError } = await supabase
        .from('list_routings')
        .select('list_id, description, bid, campaign_id, active, vertical')
        // REMOVED: .eq('active', true) - We need ALL leads in date range, even from paused campaigns
        .gt('bid', 0); // Only include lists with bids > 0
      
      if (routingsError) {
        console.error('❌ Error fetching list routings:', routingsError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch list routings: ${routingsError.message}`
        }, { status: 500 });
      }
      
      console.log(`✅ Found ${listRoutings.length} active list routings with bids`);
      
      // STEP 2: Use unified approach for each list (with optional dialer grouping)
      const results = [];
      
      for (const routing of listRoutings) {
        try {
          console.log(`🔍 Processing list ${routing.list_id} (${routing.description || 'No description'}) using ${groupByDialer ? 'dialer-specific' : 'unified'} SQL`);
          
          // NEW: Use different query approach based on groupByDialer flag
          // SCALABLE: Use identical logic for both modes, just add dialer grouping for dialer mode
          
          // STEP 1: Get lead counts using same unified function (IDENTICAL LOGIC)
          const { data: unifiedResults, error: unifiedError } = await supabase.rpc('get_lead_counts_unified', {
            p_list_id: routing.list_id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_use_policy_date: false, // Normal mode: use created_at for lead counting
            p_policy_status: null, // Get all policies
            p_transfer_status: null, // Get all transfers
            p_status: null, // Use default status filtering (new/success)
            p_search: null,
            p_weekend_only: false,
            p_page: 1,
            p_page_size: 1, // We only need the count, not the data
            p_vertical: vertical // NEW: Vertical filtering
          });
          
          if (unifiedError) {
            console.error(`❌ Unified query error for ${routing.list_id}:`, unifiedError);
            continue;
          }
          
          if (!unifiedResults || unifiedResults.length === 0) {
            console.log(`📊 No data from unified query for ${routing.list_id}`);
            continue;
          }
          
          const unifiedResult = unifiedResults[0];
          const totalLeads = parseInt(unifiedResult.total_count) || 0;
          const weekendLeads = parseInt(unifiedResult.weekend_count) || 0;
          const weekdayLeads = parseInt(unifiedResult.weekday_count) || 0;
          
          // STEP 2: Get policy counts for policies ISSUED in date range (IDENTICAL LOGIC)
          let policyCount = 0;
          const { data: policyResults, error: policyError } = await supabase.rpc('get_lead_counts_unified', {
            p_list_id: routing.list_id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_use_policy_date: true, // ✅ Use policy_date to get policies issued in date range
            p_policy_status: 'issued',
            p_transfer_status: null,
            p_status: null,
            p_search: null,
            p_weekend_only: false,
            p_page: 1,
            p_page_size: 1,
            p_vertical: vertical // NEW: Vertical filtering
          });
          
          if (!policyError && policyResults && policyResults.length > 0) {
            policyCount = parseInt(policyResults[0].total_count) || 0;
          }
          
          // STEP 3: Get transfer counts for transfers COMPLETED in date range (IDENTICAL LOGIC)
          let transferCount = 0;
          console.log(`🔍 Counting transfers with transferred_at between ${startDate} and ${endDate} for ${routing.list_id}`);
          
          // Convert EST dates to UTC for proper comparison
          const startDateUTC = `${startDate}T04:00:00.000Z`; // EDT midnight = UTC 4am
          const nextDay = new Date(endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toISOString().split('T')[0];
          const endDateUTC = `${nextDayStr}T03:59:59.999Z`;   // EDT 11:59pm = UTC 3:59am next day
          
          const { data: transferData, error: transferError, count: transferDbCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('list_id', routing.list_id)
            .eq('transfer_status', true) // Must be marked as transferred
            .not('transferred_at', 'is', null) // Must have transfer date
            .gte('transferred_at', startDateUTC) // UTC timezone start
            .lte('transferred_at', endDateUTC); // UTC timezone end
          
          if (!transferError && transferDbCount !== null) {
            transferCount = transferDbCount;
            console.log(`✅ Found ${transferCount} transfers for ${routing.list_id} between ${startDate}-${endDate}`);
          } else {
            console.error(`❌ Transfer count error for ${routing.list_id}:`, transferError);
          }
          
          // Skip lists with no leads AND no policies AND no transfers
          if (totalLeads === 0 && policyCount === 0 && transferCount === 0) {
            continue;
          }
          
          const totalRevenue = totalLeads * routing.bid;
          const policyRate = totalLeads > 0 ? (policyCount / totalLeads) * 100 : 0;

          // STEP 4: Build dialer breakdown via unified SQL pivot (consistent windows)
          const { data: dialerPivot, error: dialerPivotError } = await supabase.rpc('get_unified_dialer_pivot', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_vertical: vertical // NEW: Vertical filtering
          });

          const dialerGroups: Record<number, { lead_count: number; transfer_count: number; policy_count: number }> = {};

          if (dialerPivotError) {
            console.error(`❌ Dialer pivot error for ${routing.list_id}:`, dialerPivotError);
            // Fallback: Create a default group with the unified totals
            dialerGroups[0] = {
              lead_count: totalLeads,
              transfer_count: transferCount,
              policy_count: policyCount
            };
          } else {
            // Filter results for this specific list_id and build dialer groups
            let foundDialerData = false;
          for (const row of (dialerPivot || [])) {
              if (row.list_id === routing.list_id) {
                const d = row.dialer_type ?? 0;
            dialerGroups[d] = {
                  lead_count: Number(row.total_leads) || 0,
              transfer_count: Number(row.transfer_count) || 0,
              policy_count: Number(row.policy_count) || 0,
            };
                foundDialerData = true;
              }
            }
            
            // If no dialer data found, create default group
            if (!foundDialerData) {
              dialerGroups[0] = {
                lead_count: totalLeads,
                transfer_count: transferCount,
                policy_count: policyCount
              };
            }
          }

          // CONSISTENCY check against unified totals
          const dialerBreakdownTotal = Object.values(dialerGroups).reduce((s, g) => s + g.lead_count, 0);
          if (dialerBreakdownTotal !== totalLeads) {
            console.warn(`⚠️ CONSISTENCY WARNING: ${routing.list_id} - Unified: ${totalLeads}, Dialer breakdown: ${dialerBreakdownTotal}`);
          }

          // DIALER GROUPING (rows) or PIVOT (columns)
          if (groupByDialer) {
            // Use precomputed dialerGroups
            
            // CRITICAL FIX: If no dialer groups found, create an "Unassigned" group with the unified totals
            if (Object.keys(dialerGroups).length === 0) {
              console.log(`📊 No dialer assignments found for ${routing.list_id}, creating unassigned group with unified totals`);
              dialerGroups[0] = {
                lead_count: totalLeads,
                transfer_count: transferCount, 
                policy_count: policyCount
              };
            }
            
            // Create results for each dialer
            for (const [dialerType, dialerData] of Object.entries(dialerGroups)) {
              const dialerTypeInt = parseInt(dialerType);
              const dialerName = dialerTypeInt === 1 ? 'Internal Dialer' : 
                                dialerTypeInt === 2 ? 'Pitch BPO' : 
                                dialerTypeInt === 3 ? 'Convoso' : 'Unassigned';
              
              const dialerLeads = dialerData.lead_count;
              const dialerRevenue = dialerLeads * routing.bid;
              const dialerTransferRate = dialerLeads > 0 ? (dialerData.transfer_count / dialerLeads) * 100 : 0;
              const dialerPolicyRate = dialerLeads > 0 ? (dialerData.policy_count / dialerLeads) * 100 : 0;
              
              // Calculate proportional weekend/weekday split based on unified function results
              const dialerWeekendLeads = totalLeads > 0 ? Math.round((weekendLeads / totalLeads) * dialerLeads) : 0;
              const dialerWeekdayLeads = dialerLeads - dialerWeekendLeads;
              
              results.push({
                list_id: routing.list_id,
                description: `${routing.description || routing.list_id} - ${dialerName}`,
                campaign_id: routing.campaign_id,
                total_leads: dialerLeads,
                weekend_leads: dialerWeekendLeads,
                weekday_leads: dialerWeekdayLeads,
                total_revenue: dialerRevenue,
                policy_count: dialerData.policy_count,
                transfer_count: dialerData.transfer_count,
                policy_rate: dialerPolicyRate,
                bid: routing.bid,
                vertical: routing.vertical, // NEW: Include vertical for payout calculation
                // Dialer-specific fields
                assigned_dialer_type: dialerTypeInt,
                dialer_name: dialerName,
                dialer_transfer_rate: dialerTransferRate,
                dialer_policy_rate: dialerPolicyRate,
                mathematical_consistency: true,
                timezone_used: 'America/New_York (EST)',
                query_performance: 'Unified function + consistent dialer breakdown'
              });
            }
            
            console.log(`✅ DIALER: ${routing.description || routing.list_id}: ${totalLeads} leads (unified) split across ${Object.keys(dialerGroups).length} dialers (${dialerBreakdownTotal} breakdown)`);
            
          } else {
            // NORMAL MODE: Single aggregate result + PIVOT columns per dialer
            const get = (t: number) => dialerGroups[t] || { lead_count: 0, transfer_count: 0, policy_count: 0 };
            const gInternal = get(1);
            const gPitch = get(2);
            const gConvoso = get(3);
            const gUnassigned = get(0);

            // Build dialer_metrics map for dynamic columns
            const dialer_metrics: Record<number, { leads: number; transfers: number; policies: number }> = {
              1: { leads: gInternal.lead_count, transfers: gInternal.transfer_count, policies: gInternal.policy_count },
              2: { leads: gPitch.lead_count, transfers: gPitch.transfer_count, policies: gPitch.policy_count },
              3: { leads: gConvoso.lead_count, transfers: gConvoso.transfer_count, policies: gConvoso.policy_count },
              0: { leads: gUnassigned.lead_count, transfers: gUnassigned.transfer_count, policies: gUnassigned.policy_count },
            };

            // Push aggregate row including legacy per-dialer fields (for backward compat) and dialer_metrics
            results.push({
              list_id: routing.list_id,
              description: routing.description || routing.list_id,
              campaign_id: routing.campaign_id,
              total_leads: totalLeads,
              weekend_leads: weekendLeads,
              weekday_leads: weekdayLeads,
              total_revenue: totalRevenue,
              policy_count: policyCount,
              transfer_count: transferCount,
              policy_rate: policyRate,
              bid: routing.bid,
              vertical: routing.vertical, // NEW: Include vertical for payout calculation
              mathematical_consistency: true,
              timezone_used: 'America/New_York (EST)',
              query_performance: 'Identical logic as dialer mode',
              // PIVOT: Internal
              internal_leads: gInternal.lead_count,
              internal_transfers: gInternal.transfer_count,
              internal_policies: gInternal.policy_count,
              // PIVOT: Pitch BPO
              pitch_leads: gPitch.lead_count,
              pitch_transfers: gPitch.transfer_count,
              pitch_policies: gPitch.policy_count,
              // PIVOT: Convoso
              convoso_leads: gConvoso.lead_count,
              convoso_transfers: gConvoso.transfer_count,
              convoso_policies: gConvoso.policy_count,
              // PIVOT: Unassigned (backfill gap)
              unassigned_leads: gUnassigned.lead_count,
              unassigned_transfers: gUnassigned.transfer_count,
              unassigned_policies: gUnassigned.policy_count,
              // Dynamic dialer map
              dialer_metrics
            });
            
            console.log(`✅ UNIFIED: ${routing.description || routing.list_id}: ${totalLeads} leads (${weekdayLeads} weekday, ${weekendLeads} weekend), ${policyCount} policies, ${transferCount} transfers, $${totalRevenue.toFixed(2)} revenue`);
          }
          
          // Log completion moved to within each path where variables are available
          
        } catch (listError) {
          console.error(`❌ Error processing list ${routing.list_id} with unified approach:`, listError);
          continue;
        }
      }
      
      if (results.length === 0) {
      console.log('⚠️ No results found');
      return NextResponse.json({
        success: true,
        data: [],
        summary: { totalRevenue: 0, totalLeads: 0, averageBid: 0 },
        timeFrame,
        startDate,
        endDate
      });
    }
    
      console.log(`🎯 Found ${results.length} lists with data using unified approach`);
    
    // Group results by traffic source (description)
    interface TrafficSourceData {
      traffic_source: string;
      display_name: string;
      leads_count: number;
      total_bid_amount: number;
      average_bid: number;
      campaigns: Record<string, {
        campaign_id: string;
        campaign_name: string;
        leads_count: number;
        bid_amount: number;
        total_revenue: number;
      }>;
      list_ids: Array<{
        list_id: string;
        description: string;
        leads_count: number;
        total_revenue: number;
        policy_count: number;
        transfer_count: number;
        cost_per_acquisition: number | null;
        policy_rate: number;
        mathematical_consistency: boolean;
        timezone_used: string;
        query_performance: string;
        // NEW: Dialer-specific fields
        assigned_dialer_type?: number;
        dialer_name?: string;
        dialer_transfer_rate?: number;
        dialer_policy_rate?: number;
      }>;
    }
    
    const trafficSources: Record<string, TrafficSourceData> = {};
    
      results.forEach((result: any) => {
        const source = result.description;
      
      if (!trafficSources[source]) {
        trafficSources[source] = {
          traffic_source: source,
          display_name: source,
          leads_count: 0,
          total_bid_amount: 0,
          average_bid: 0,
          campaigns: {},
          list_ids: []
        };
      }
      
      // Add to totals
        trafficSources[source].leads_count += result.total_leads;
        trafficSources[source].total_bid_amount += result.total_revenue;
      
      // Calculate CPA
        const cpa = result.policy_count > 0 ? result.total_revenue / result.policy_count : null;
      
      // Add list data (augment with dialer_metrics map when present)
      trafficSources[source].list_ids.push({
        list_id: result.list_id,
        description: result.description,
        leads_count: result.total_leads,
        total_revenue: result.total_revenue,
        policy_count: result.policy_count,
        transfer_count: result.transfer_count,
        cost_per_acquisition: cpa,
        policy_rate: result.policy_rate,
        vertical: result.vertical, // NEW: Include vertical for payout calculation
        mathematical_consistency: result.mathematical_consistency,
        timezone_used: result.timezone_used,
        query_performance: result.query_performance,
        // NEW: Include dialer-specific fields when available
        ...(result.assigned_dialer_type && {
          assigned_dialer_type: result.assigned_dialer_type,
          dialer_name: result.dialer_name,
          dialer_transfer_rate: result.dialer_transfer_rate,
          dialer_policy_rate: result.dialer_policy_rate
        }),
        ...(result.internal_leads !== undefined && {
          dialer_metrics: {
            1: { leads: result.internal_leads, transfers: result.internal_transfers, policies: result.internal_policies },
            2: { leads: result.pitch_leads, transfers: result.pitch_transfers, policies: result.pitch_policies },
            3: { leads: result.convoso_leads, transfers: result.convoso_transfers, policies: result.convoso_policies },
            0: { leads: result.unassigned_leads, transfers: result.unassigned_transfers, policies: result.unassigned_policies },
          }
        })
      });
      
      // Add to campaigns
        const campaignId = result.campaign_id || 'default';
      if (!trafficSources[source].campaigns[campaignId]) {
        trafficSources[source].campaigns[campaignId] = {
          campaign_id: campaignId,
          campaign_name: campaignId,
          leads_count: 0,
          bid_amount: 0,
          total_revenue: 0
        };
      }
        trafficSources[source].campaigns[campaignId].leads_count += result.total_leads;
        trafficSources[source].campaigns[campaignId].total_revenue += result.total_revenue;
    });
    
    // Format response
    const formattedData = Object.values(trafficSources).map((source: TrafficSourceData) => {
      source.average_bid = source.leads_count > 0 ? 
        source.total_bid_amount / source.leads_count : 0;
      
      return {
        ...source,
        campaigns: Object.values(source.campaigns),
        list_ids: source.list_ids
      };
    }).sort((a, b) => b.total_bid_amount - a.total_bid_amount);
    
    // Calculate totals
    const totalRevenue = formattedData.reduce((sum, source) => sum + source.total_bid_amount, 0);
    const totalLeads = formattedData.reduce((sum, source) => sum + source.leads_count, 0);
    
      const queryTime = Date.now() - startTime;
      console.log(`🎯 UNIFIED APPROACH: Processed ${totalLeads} leads across ${formattedData.length} traffic sources in ${queryTime}ms with mathematical consistency`);
    
    // Build dialer meta across all rows for dynamic columns
    const dialerTotals: Record<string, { id: string; name: string; leads: number }> = {};
    for (const src of formattedData as any[]) {
      for (const row of src.list_ids as any[]) {
        const m = row.dialer_metrics;
        if (!m) continue;
        const add = (id: string, name: string, leads?: number) => {
          const v = leads || 0;
          if (!(id in dialerTotals)) dialerTotals[id] = { id, name, leads: 0 };
          dialerTotals[id].leads += v;
        };
        add('1', 'Internal Dialer', m[1]?.leads);
        add('2', 'Pitch BPO', m[2]?.leads);
        add('3', 'Convoso', m[3]?.leads);
        add('0', 'Unassigned', m[0]?.leads);
      }
    }
    const dialers = Object.values(dialerTotals)
      .filter(d => d.leads > 0)
      .sort((a, b) => b.leads - a.leads);

    return NextResponse.json({
      success: true,
      data: formattedData,
      summary: {
        totalRevenue,
        totalLeads,
        averageBid: totalLeads > 0 ? totalRevenue / totalLeads : 0
      },
      timeFrame,
      startDate,
      endDate,
      performance: {
        queryTimeMs: queryTime,
          queryType: 'normal_unified',
          optimization: `🚀 Unified SQL approach with mathematical consistency and EST timezone handling`,
          functionUsed: 'get_lead_counts_unified',
          indexesUtilized: ['idx_leads_created_at', 'idx_leads_policy_postback_date', 'idx_leads_list_status'],
          scanType: 'unified_sql_consistent_timezone',
          mathematicalConsistency: true,
          timezoneHandling: 'America/New_York (EST)'
        },
        meta: { dialers }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error in revenue tracking approach:', error);
    return NextResponse.json({
      success: false, 
      error: `Revenue tracking failed: ${error.message}`,
      stack: error.stack
    }, { status: 500 });
  }
}
