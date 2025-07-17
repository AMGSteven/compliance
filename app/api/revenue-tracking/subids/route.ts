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
    
    // Get issued policies for this list_id in the date range (matches main revenue API exactly)
    const { data: policyLeads, error: policyError } = await supabase
      .from('leads')
      .select('id, custom_fields, policy_postback_date, created_at, list_id, transfer_status')
      .eq('list_id', listId)
      .eq('policy_status', 'issued')
      .gte('policy_postback_date', `${effectiveStartDate}T00:00:00-05:00`)
      .lte('policy_postback_date', `${effectiveEndDate}T23:59:59-05:00`)
      .limit(50000);
    
    if (policyError) {
      console.error('Error fetching policy leads:', policyError);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch policy data: ${policyError.message}`
      });
    }
    
    console.log(`Found ${policyLeads?.length || 0} issued policies in date range for list_id ${listId} (matches main API approach) - UPDATED`);
    
    // Get total lead count first (like main API does)
    const { count: totalLeadCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .in('status', ['new', 'success']) // Include both new (modern) and success (legacy) leads
      .gte('created_at', `${effectiveStartDate}T00:00:00-05:00`)
      .lte('created_at', `${effectiveEndDate}T23:59:59-05:00`);
      
    if (countError) {
      console.error('Error getting total lead count:', countError);
      return NextResponse.json({
        success: false,
        error: `Failed to get lead count: ${countError.message}`
      });
    }
    
    console.log(`Total leads in range for list_id ${listId}: ${totalLeadCount}`);
    
    // Use smart pagination like main API (1000 rows per page due to Supabase limit)
    let allLeads: any[] = [];
    const PAGE_SIZE = 1000; // Supabase's actual limit per query
    const totalPages = Math.ceil((totalLeadCount || 0) / PAGE_SIZE);
    
    console.log(`Fetching ${totalLeadCount} leads in ${totalPages} pages...`);
    
    // Fetch all leads in batches
    for (let page = 0; page < totalPages; page++) {
      const { data: pageLeads, error: pageError } = await supabase
        .from('leads')
        .select('id, custom_fields, created_at, policy_status, policy_postback_date')
        .eq('list_id', listId)
        .in('status', ['new', 'success']) // Include both new (modern) and success (legacy) leads
        .gte('created_at', `${effectiveStartDate}T00:00:00-05:00`)
        .lte('created_at', `${effectiveEndDate}T23:59:59-05:00`)
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
    
    console.log(`Total leads fetched: ${allLeads.length} (expected: ${totalLeadCount})`);
    
    console.log(`Found ${allLeads?.length || 0} leads created in date range for list_id ${listId} (for volume context)`);
    
    // Fetch cost data for this list_id and date range
    const { data: costData, error: costError } = await supabase
      .from('pitch_perfect_costs')
      .select('lead_id, billable_cost')
      .eq('billable_status', 'billable')
      .gte('created_at', `${effectiveStartDate}T00:00:00-05:00`)
      .lte('created_at', `${effectiveEndDate}T23:59:59-05:00`);
    
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
    
    // Process leads and group by SUBID - PRIORITIZE POLICY DATA (revenue focus)
    const subidGroups: Record<string, SubIdAggregation> = {};
    
    // Step 1: Process policy leads first (this drives revenue - matches main API)
    if (policyLeads) {
      policyLeads.forEach(lead => {
        const subidValue = normalizeSubIdKey(lead.custom_fields) || 'No SUBID';
        
        // Create SUBID group
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
        
        // Increment policy count (this is the core revenue metric)
        subidGroups[subidValue].policy_count++;
        
        // Increment transfer count if this policy lead was transferred
        if (lead.transfer_status === true) {
          subidGroups[subidValue].transfer_count++;
        }
        
        // Add cost if available for this policy lead
        if (costMap[lead.id]) {
          subidGroups[subidValue].total_cost += costMap[lead.id];
        }
      });
    }
    
    console.log(`Created ${Object.keys(subidGroups).length} SUBID groups from policy data`);
    
    // Step 2: Supplement with lead volume data for context (but don't override policy-driven groups)
    if (allLeads) {
      allLeads.forEach(lead => {
        const subidValue = normalizeSubIdKey(lead.custom_fields) || 'No SUBID';
        
        // Only create new group if policy data didn't already create it
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
        
        // Add lead volume data
        subidGroups[subidValue].leads_count++;
        
        // Check if this lead was created on weekend
        const leadDate = new Date(lead.created_at);
        const dayOfWeek = leadDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          subidGroups[subidValue].weekend_leads++;
        } else {
          subidGroups[subidValue].weekday_leads++;
        }
        
        // Add cost if available (but don't double-count if already added from policy data)
        if (costMap[lead.id] && !policyLeads?.find(p => p.id === lead.id)) {
          subidGroups[subidValue].total_cost += costMap[lead.id];
        }
      });
    }
    
    // Get transferred leads for this list_id in the date range
    const { data: transferLeads, error: transferError } = await supabase
      .from('leads')
      .select('id, custom_fields, transferred_at, created_at, list_id')
      .eq('list_id', listId)
      .eq('transfer_status', true)
      .gte('transferred_at', `${effectiveStartDate}T00:00:00-05:00`)
      .lte('transferred_at', `${effectiveEndDate}T23:59:59-05:00`)
      .limit(50000);
    
    if (transferError) {
      console.error('Error fetching transfer leads:', transferError);
    }
    
    // Step 3: Process transferred leads (add to groups from policies/leads)
    if (transferLeads) {
      transferLeads.forEach(lead => {
        const subidValue = normalizeSubIdKey(lead.custom_fields) || 'No SUBID';
        
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
        
        subidGroups[subidValue].transfer_count++;
        
        // Add cost if available
        if (costMap[lead.id]) {
          subidGroups[subidValue].total_cost += costMap[lead.id];
        }
      });
    }
    
    // Get list routing info for cost_per_lead calculation
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('bid, description')
      .eq('list_id', listId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    
    const costPerLead = routingData?.bid || 0;
    const listDescription = routingData?.description || listId;
    
    // Convert to final format
    const subidResults = Object.values(subidGroups).map(group => {
      // Calculate policy rate: (synergy_issued_leads / leads_count) * 100
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
    
    console.log(`Returning ${subidResults.length} SUBID breakdowns for list_id ${listId}`);
    
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
        total_leads_with_subids: subidResults.reduce((sum, item) => sum + item.leads_count, 0)
      }
    });
    
  } catch (error: any) {
    console.error('Error in SUBID API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred while fetching SUBID data'
    }, { status: 500 });
  }
}
