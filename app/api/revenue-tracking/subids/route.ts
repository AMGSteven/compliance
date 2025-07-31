import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SubIdAggregation {
  subid_value: string;
  leads_count: number;
  weekday_leads: number;
  weekend_leads: number;
  policy_count: number;
  transfer_count: number;
  total_cost: number;
}

// Normalize SUBID key variations for consistent analytics
function normalizeSubIdKey(customFields: any): string | null {
  if (!customFields || typeof customFields !== 'object') return null;
  
  // Check common SUBID key variations (case-insensitive)
  const subidKeys = ['subid', 'sub_id', 'SUBID', 'SUB_ID', 'SubId', 'subId'];
  
  for (const key of subidKeys) {
    const value = customFields[key];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching SUBID breakdown data...');
    const supabase = createServerClient();
    
    // Get query parameters
    const url = new URL(request.url);
    const listId = url.searchParams.get('list_id');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    if (!listId) {
      return NextResponse.json({
        success: false,
        error: 'list_id parameter is required'
      }, { status: 400 });
    }
    
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate parameters are required'
      }, { status: 400 });
    }
    
    console.log(`Fetching SUBID data for list_id: ${listId}, dateRange: ${startDate} to ${endDate}`);
    
    const effectiveStartDate = startDate;
    const effectiveEndDate = endDate;
    
    // ✅ FIXED: Convert EDT dates to UTC for proper comparison (July = EDT = UTC-4)
    const startDateUTC = `${effectiveStartDate}T04:00:00.000Z`; // EDT midnight = UTC 4am
    const nextDay = new Date(effectiveEndDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];
    const endDateUTC = `${nextDayStr}T03:59:59.999Z`; // EDT 23:59:59 = UTC 3:59am next day
    
    console.log(`🕐 Using EDT timezone conversion: ${startDateUTC} to ${endDateUTC}`);
    
    // ✅ FIXED: LEAD-FIRST APPROACH (matches main revenue API)
    // Get total lead count first (like main API does)
    const { count: totalLeadCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .in('status', ['new', 'success']) // Include both new (modern) and success (legacy) leads
      .gte('created_at', startDateUTC)
      .lte('created_at', endDateUTC);
      
    if (countError) {
      console.error('Error getting total lead count:', countError);
      return NextResponse.json({
        success: false,
        error: `Failed to get lead count: ${countError.message}`
      });
    }
    
    console.log(`✅ Total leads in range for list_id ${listId}: ${totalLeadCount} (matches main API)`);
    
    // Use smart pagination like main API (1000 rows per page due to Supabase limit)
    let allLeads: any[] = [];
    const PAGE_SIZE = 1000; // Supabase's actual limit per query
    const totalPages = Math.ceil((totalLeadCount || 0) / PAGE_SIZE);
    
    console.log(`Fetching ${totalLeadCount} leads in ${totalPages} pages...`);
    
    // ✅ FIXED: Fetch ALL leads created in date range (same as main API)
    for (let page = 0; page < totalPages; page++) {
      const { data: pageLeads, error: pageError } = await supabase
        .from('leads')
        .select('id, custom_fields, created_at, policy_status, policy_postback_date, transfer_status, transferred_at')
        .eq('list_id', listId)
        .in('status', ['new', 'success']) // Include both new (modern) and success (legacy) leads
        .gte('created_at', startDateUTC)
        .lte('created_at', endDateUTC)
        .order('created_at', { ascending: false})
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
        console.log(`Fetched page ${page + 1}/${totalPages}: ${pageLeads.length} leads (total: ${allLeads.length})`);
      }
    }
    
    console.log(`✅ Total leads fetched: ${allLeads.length} (expected: ${totalLeadCount})`);
    
    // Fetch cost data for this list_id and date range (using same EDT conversion)
    const { data: costData, error: costError } = await supabase
      .from('pitch_perfect_costs')
      .select('lead_id, billable_cost')
      .eq('billable_status', 'billable')
      .gte('created_at', startDateUTC)
      .lte('created_at', endDateUTC);
    
    if (costError) {
      console.error('Error fetching cost data:', costError);
    }
    
    // Create cost lookup map
    const costMap: Record<string, number> = {};
    if (costData) {
      costData.forEach(cost => {
        if (cost.lead_id && cost.billable_cost) {
          costMap[cost.lead_id] = cost.billable_cost;
        }
      });
    }
    
    // ✅ FIXED: Process ALL leads and group by SUBID (lead-first approach)
    const subidGroups: Record<string, SubIdAggregation> = {};
    
    console.log(`🔍 Processing ${allLeads.length} leads and grouping by SUBID...`);
    
    // Process all leads created in date range
    allLeads.forEach(lead => {
      const subidValue = normalizeSubIdKey(lead.custom_fields) || 'No SUBID';
      
      // Create SUBID group if it doesn't exist
      if (!subidGroups[subidValue]) {
        subidGroups[subidValue] = {
          subid_value: subidValue,
          leads_count: 0,
          weekday_leads: 0,
          weekend_leads: 0,
          policy_count: 0,
          transfer_count: 0,
          total_cost: 0
        };
      }
      
      // ✅ Increment lead count (core metric that drives totals)
      subidGroups[subidValue].leads_count++;
      
      // Check if this lead was created on weekend
      const leadDate = new Date(lead.created_at);
      const dayOfWeek = leadDate.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        subidGroups[subidValue].weekend_leads++;
      } else {
        subidGroups[subidValue].weekday_leads++;
      }
      
      // ✅ Check if this lead has policy issued (any time, not just in date range)
      if (lead.policy_status === 'issued') {
        subidGroups[subidValue].policy_count++;
      }
      
      // ✅ Check if this lead was transferred (any time, not just in date range)
      if (lead.transfer_status === true) {
        subidGroups[subidValue].transfer_count++;
      }
      
      // Add cost if available for this lead
      if (costMap[lead.id]) {
        subidGroups[subidValue].total_cost += costMap[lead.id];
      }
    });
    
    console.log(`✅ Created ${Object.keys(subidGroups).length} SUBID groups from ${allLeads.length} leads`);
    
    // Get list routing info for cost calculation
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('bid, description')
      .eq('list_id', listId)
      .eq('active', true)
      .single();
    
    if (routingError) {
      console.error('Error fetching routing data:', routingError);
    }
    
    const costPerLead = routingData?.bid || 0.45; // Default cost per lead
    const listDescription = routingData?.description || listId;
    
    // Convert to final format
    const subidResults = Object.values(subidGroups).map(group => {
      // Calculate policy rate: (policy_count / leads_count) * 100
      const policyRate = group.leads_count > 0
        ? (group.policy_count / group.leads_count) * 100
        : 0;
        
      return {
        key: `${listId}-${group.subid_value}`,
        list_id: listId,
        description: `${listDescription} - ${group.subid_value}`,
        subid_value: group.subid_value,
        parent_list_id: listId,
        leads_count: group.leads_count,
        weekday_leads: group.weekday_leads,
        weekend_leads: group.weekend_leads,
        cost_per_lead: costPerLead,
        total_lead_costs: group.weekday_leads * costPerLead, // Only weekday leads contribute to costs
        synergy_issued_leads: group.policy_count,
        synergy_payout: group.policy_count * 120, // $120 per issued policy
        ai_costs_allocated: group.total_cost,
        net_profit: (group.policy_count * 120) - (group.weekday_leads * costPerLead) - group.total_cost,
        policy_rate: policyRate,
        transfers_count: group.transfer_count,
        is_subid_row: true
      };
    });
    
    // Sort by leads count descending
    subidResults.sort((a, b) => b.leads_count - a.leads_count);
    
    const totalSubidLeads = subidResults.reduce((sum, item) => sum + item.leads_count, 0);
    console.log(`✅ Returning ${subidResults.length} SUBID breakdowns for list_id ${listId}`);
    console.log(`✅ Total leads across all SUBIDs: ${totalSubidLeads} (should match ${totalLeadCount} from main API)`);
    
    return NextResponse.json({
      success: true,
      data: subidResults,
      meta: {
        list_id: listId,
        date_range: {
          start: effectiveStartDate,
          end: effectiveEndDate
        },
        total_subids: subidResults.length,
        total_leads_with_subids: totalSubidLeads,
        timezone_used: 'EDT (UTC-4)',
        query_approach: 'FIXED: Lead-first (matches main API)'
      }
    });
    
  } catch (error: any) {
    console.error('Error in SUBID API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
