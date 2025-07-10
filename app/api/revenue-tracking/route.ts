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
    console.log('Fetching revenue tracking data WITHOUT any filtering...');
    const supabase = createServerClient();
    
    // Get query parameters for filtering
    const url = new URL(request.url);
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');
    const timeFrame = url.searchParams.get('timeFrame') || 'all';
    
    // Apply intelligent date filtering to prevent timeout issues
    if (timeFrame === 'custom' && startDate && endDate) {
      console.log(`CUSTOM DATE RANGE: ${startDate} to ${endDate}`);
    } else {
      // Default to last 30 days to prevent performance issues with full table scans
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString();
      endDate = new Date().toISOString();
      console.log(`DEFAULT DATE RANGE (last 30 days): ${startDate} to ${endDate}`);
    }
    
    // STEP 1: Fetch list routings for bid information and descriptions
    const { data: listRoutings, error: routingsError } = await supabase
      .from('list_routings')
      .select('*');
    
    if (routingsError) {
      console.error('Error fetching list routings:', routingsError);
      return NextResponse.json({
        success: false,
        error: routingsError.message
      });
    }
    
    console.log(`Found ${listRoutings?.length || 0} list routings`);
    
    // Create lookup maps for bids and descriptions
    interface RoutingInfo {
      bid: number;
      description: string;
      campaign_id: string;
    }
    
    const routingMap: Record<string, RoutingInfo> = {};
    listRoutings.forEach((routing: ListRouting) => {
      if (routing.active && routing.bid) {
        routingMap[routing.list_id] = {
          bid: routing.bid,
          description: routing.description || routing.list_id,
          campaign_id: routing.campaign_id
        };
      }
    });
    
    // STEP 2: Fetch successful leads AND policy data efficiently with proper date filtering
    console.log('Fetching successful leads and policy data with date filtering...');
    
    // Build the query for successful leads (for cost calculation)
    let leadsQuery = supabase
      .from('leads')
      .select('id, list_id, campaign_id, traffic_source, created_at, status, policy_status, policy_postback_date')
      .eq('status', 'success')
      .gte('created_at', startDate!)
      .lte('created_at', endDate!);
    
    // Get total count for pagination planning
    const { count: totalCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', startDate!)
      .lte('created_at', endDate!);
    
    if (countError) {
      console.error('Error getting total lead count:', countError);
      return NextResponse.json({
        success: false, 
        error: countError.message
      });
    }
    
    console.log(`Total successful leads in date range: ${totalCount}`);
    
    // Use smart pagination to avoid timeouts
    let allLeads: any[] = [];
    const PAGE_SIZE = 10000; // Smaller page size for reliability
    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
    
    // Fetch all leads in batches
    for (let page = 0; page < totalPages; page++) {
      const { data: pageLeads, error: pageError } = await leadsQuery
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      if (pageError) {
        console.error(`Error fetching leads page ${page}:`, pageError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch leads: ${pageError.message}`
        });
      }
      
      if (pageLeads && pageLeads.length > 0) {
        allLeads = allLeads.concat(pageLeads);
      }
      
      console.log(`Fetched page ${page + 1}/${totalPages} with ${pageLeads?.length || 0} leads`);
    }
    
    // Also fetch policy data for CPA calculation (policies issued in the same date range)
    const { data: policyLeads, error: policyError } = await supabase
      .from('leads')
      .select('list_id, policy_status, policy_postback_date')
      .eq('policy_status', 'issued')
      .gte('policy_postback_date', startDate!)
      .lte('policy_postback_date', endDate!);
    
    if (policyError) {
      console.error('Error fetching policy data:', policyError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch policy data: ${policyError.message}`
      });
    }
    
    console.log(`Found ${policyLeads?.length || 0} issued policies in date range`);
    
    const leads = allLeads;
    
    if (leads.length === 0) {
      console.log('No leads found in the selected time period');
    }
    
    console.log(`Found ${leads?.length || 0} successful leads in the selected time period`);
    
    // STEP 3: Group leads by traffic source with CPA calculation
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
      list_ids: Record<string, {
        list_id: string;
        description: string;
        leads_count: number;
        total_revenue: number;
        policy_count: number;
        cost_per_acquisition: number | null;
      }>;
    }
    
    // Create policy count map for efficient lookup
    const policyCountByList: Record<string, number> = {};
    (policyLeads || []).forEach((policy: any) => {
      if (policy.list_id) {
        policyCountByList[policy.list_id] = (policyCountByList[policy.list_id] || 0) + 1;
      }
    });
    
    const trafficSources: Record<string, TrafficSourceData> = {};
    
    leads.forEach((lead: any) => {
      // Get the routing info for this list_id
      const routing = routingMap[lead.list_id];
      
      // Skip if we don't have routing information
      if (!routing) {
        console.log(`No routing found for list ID: ${lead.list_id}`);  
        return;
      }
      
      // Use description as the traffic source name
      const source = routing.description;
      
      // Create entry for traffic source if it doesn't exist
      if (!trafficSources[source]) {
        trafficSources[source] = {
          traffic_source: source,
          display_name: source, // Use the description directly as the display name
          leads_count: 0,
          total_bid_amount: 0,
          average_bid: 0,
          campaigns: {},
          list_ids: {}
        };
      }
      
      // Increment counts
      trafficSources[source].leads_count++;
      
      // Get bid amount from routing
      const bidAmount = routing.bid;
      
      // Add to revenue
      trafficSources[source].total_bid_amount += bidAmount;
      
      // Track by campaign
      const campaignId = lead.campaign_id || routing.campaign_id || 'default';
      if (campaignId) {
        if (!trafficSources[source].campaigns[campaignId]) {
          trafficSources[source].campaigns[campaignId] = {
            campaign_id: campaignId,
            campaign_name: campaignId,
            leads_count: 0,
            bid_amount: bidAmount,
            total_revenue: 0
          };
        }
        trafficSources[source].campaigns[campaignId].leads_count++;
        trafficSources[source].campaigns[campaignId].total_revenue += bidAmount;
      }
      
      // Track by list_id with CPA calculation
      if (lead.list_id) {
        if (!trafficSources[source].list_ids[lead.list_id]) {
          const policyCount = policyCountByList[lead.list_id] || 0;
          trafficSources[source].list_ids[lead.list_id] = {
            list_id: lead.list_id,
            description: routing.description,
            leads_count: 0,
            total_revenue: 0,
            policy_count: policyCount,
            cost_per_acquisition: null // Will be calculated after aggregation
          };
        }
        trafficSources[source].list_ids[lead.list_id].leads_count++;
        trafficSources[source].list_ids[lead.list_id].total_revenue += bidAmount;
      }
    });
    
    // STEP 4: Format the response
    const formattedData = Object.values(trafficSources).map((source: TrafficSourceData) => {
      // Calculate average bid
      source.average_bid = source.leads_count > 0 ? 
        source.total_bid_amount / source.leads_count : 0;
      
      // Convert campaigns and list_ids from objects to arrays
      const campaignsArray = Object.values(source.campaigns);
      const listIdsArray = Object.values(source.list_ids).map(listData => {
        // Calculate CPA for each list: total_revenue / policy_count
        const cpa = listData.policy_count > 0 
          ? listData.total_revenue / listData.policy_count 
          : null;
        
        return {
          ...listData,
          cost_per_acquisition: cpa
        };
      });
      
      return {
        ...source,
        campaigns: campaignsArray,
        list_ids: listIdsArray
      };
    }).sort((a, b) => b.total_bid_amount - a.total_bid_amount);
    
    console.log(`Successfully processed revenue data for ${formattedData.length} traffic sources`);
    
    // Calculate totals for summary stats
    const totalRevenue = formattedData.reduce((sum, source) => sum + source.total_bid_amount, 0);
    const totalLeads = formattedData.reduce((sum, source) => sum + source.leads_count, 0);
    
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
      endDate
    });
  } catch (error: any) {
    console.error('Error in revenue tracking API:', error);
    return NextResponse.json({
      success: false, 
      error: error.message
    }, { status: 500 });
  }
}

// No longer needed as we use the description directly
// function getDisplayName(source: string): string {
//   return source;
// }
