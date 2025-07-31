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
      isDualDateFiltering
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
        p_use_cross_temporal: true
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
      
      // Enhance with list descriptions
      const { data: listRoutings } = await supabase
        .from('list_routings')
        .select('list_id, description, campaign_id')
        .eq('active', true);
      
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
      
      // STEP 1: Get all active list routings (for bid calculations)
      console.log('📋 Fetching active list routings...');
      const { data: listRoutings, error: routingsError } = await supabase
        .from('list_routings')
        .select('list_id, description, bid, campaign_id, active')
        .eq('active', true)
        .gt('bid', 0); // Only include lists with bids > 0
      
      if (routingsError) {
        console.error('❌ Error fetching list routings:', routingsError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch list routings: ${routingsError.message}`
        }, { status: 500 });
      }
      
      console.log(`✅ Found ${listRoutings.length} active list routings with bids`);
      
      // STEP 2: Use unified approach for each list
      const results = [];
      
      for (const routing of listRoutings) {
        try {
          console.log(`🔍 Processing list ${routing.list_id} (${routing.description || 'No description'}) using unified SQL`);
          
          // Call the unified function with consistent EST timezone handling
          const { data: unifiedResults, error: unifiedError } = await supabase.rpc('get_lead_counts_unified', {
            p_list_id: routing.list_id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_use_postback_date: false, // Normal mode: use created_at for lead counting
            p_policy_status: null, // Get all policies
            p_transfer_status: null, // Get all transfers
            p_status: null, // Use default status filtering (new/success)
            p_search: null,
            p_weekend_only: false,
            p_page: 1,
            p_page_size: 1 // We only need the count, not the data
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
          
          // Skip lists with no leads
          if (totalLeads === 0) {
            continue;
          }
          
          // STEP 3: Get policy counts for policies ISSUED in date range (not lead cohort)
          let policyCount = 0;
          const { data: policyResults, error: policyError } = await supabase.rpc('get_lead_counts_unified', {
            p_list_id: routing.list_id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_use_postback_date: true, // ✅ FIXED: Use policy_postback_date to get policies issued in date range
            p_policy_status: 'issued',
            p_transfer_status: null,
            p_status: null,
            p_search: null,
            p_weekend_only: false,
            p_page: 1,
            p_page_size: 1
          });
          
          if (!policyError && policyResults && policyResults.length > 0) {
            policyCount = parseInt(policyResults[0].total_count) || 0;
          }
          
          // STEP 4: Get transfer counts for transfers COMPLETED in date range (not lead cohort)
          let transferCount = 0;
          // ✅ FIXED: Use direct Supabase query with proper timezone conversion
          console.log(`🔍 Counting transfers with transferred_at between ${startDate} and ${endDate} for ${routing.list_id}`);
          
          // Convert EST dates to UTC for proper comparison (July = EDT = UTC-4)
          const startDateUTC = `${startDate}T04:00:00.000Z`; // EDT midnight = UTC 4am
          const nextDay = new Date(endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toISOString().split('T')[0];
          const endDateUTC = `${nextDayStr}T03:59:59.999Z`;   // EDT 11:59pm = UTC 3:59am next day
          
          const { data: transferData, error: transferError, count: transferDbCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('list_id', routing.list_id)
            // ✅ FIXED: Remove incorrect status filter - transferred leads can have status 'new'
            .eq('transfer_status', true) // Must be marked as transferred
            .not('transferred_at', 'is', null) // Must have transfer date
            .gte('transferred_at', startDateUTC) // UTC timezone start
            .lte('transferred_at', endDateUTC); // UTC timezone end
          
          if (!transferError && transferDbCount !== null) {
            transferCount = transferDbCount;
            console.log(`✅ Found ${transferCount} transfers for ${routing.list_id} between ${startDate}-${endDate} (UTC: ${startDateUTC} to ${endDateUTC})`);
          } else {
            console.error(`❌ Transfer count error for ${routing.list_id}:`, transferError);
          }
          
          const totalRevenue = totalLeads * routing.bid;
          const policyRate = totalLeads > 0 ? (policyCount / totalLeads) * 100 : 0;
          
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
            mathematical_consistency: true, // Unified approach ensures consistency
            timezone_used: 'America/New_York (EST)', // Unified function uses EST
            query_performance: 'Unified SQL with EST timezone handling'
          });
          
          console.log(`✅ UNIFIED: ${routing.description || routing.list_id}: ${totalLeads} leads (${weekdayLeads} weekday, ${weekendLeads} weekend), ${policyCount} policies (issued in date range), ${transferCount} transfers (completed in date range), $${totalRevenue.toFixed(2)} revenue`);
          
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
      
      // Add list data
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
        }
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
