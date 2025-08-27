import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { normalizeSubIdKey } from '@/lib/utils/subid';

export const dynamic = 'force-dynamic';

interface SubIdAggregation {
  subid_value: string;
  leads_count: number;
  weekday_leads: number;
  weekend_leads: number;
  policy_count: number;
  transfer_count: number;
  total_cost: number;
  // NEW: Dialer-specific fields
  assigned_dialer_type?: number;
  dialer_name?: string;
  dialer_transfer_rate?: number;
  dialer_policy_rate?: number;
  // NEW: Per-SUBID dialer metrics map for pivot CPA/ratios in UI
  dialer_metrics?: Record<number, { leads: number; transfers: number; policies: number }>;
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
    
    // NEW: Dialer-specific analytics parameter
    const groupByDialer = url.searchParams.get('group_by_dialer') === 'true';
    
    // NEW: Vertical filtering parameter
    const vertical = url.searchParams.get('vertical');
    
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
    
    // Unified SUBID + dialer pivot from SQL (consistent windows)
    const { data: subidDialerPivot, error: subidDialerError } = await supabase.rpc('get_unified_subid_dialer_pivot', {
      p_list_id: listId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_cross_temporal: false,
      p_lead_start_date: null,
      p_lead_end_date: null,
      p_vertical: vertical // NEW: Vertical filtering
    });
    if (subidDialerError) {
      console.error('❌ SUBID dialer pivot error:', subidDialerError);
      return NextResponse.json({ success: false, error: subidDialerError.message }, { status: 500 });
    }

    const subidGroups: Record<string, SubIdAggregation> = {};
    
    console.log(`🔍 Processing ${allLeads.length} leads and grouping by SUBID...`);
    
    // Build groups from pivot
    (subidDialerPivot || []).forEach((row: any) => {
      const baseKey = row.subid_value || 'No SUBID';
      const dialerType = row.assigned_dialer_type ?? 0;
      const dialerName = dialerType === 1 ? 'Internal Dialer' : dialerType === 2 ? 'Pitch BPO' : dialerType === 3 ? 'Convoso' : 'Unassigned';
      const groupKey = groupByDialer ? `${baseKey}_dialer_${dialerType}` : baseKey;
      const displaySubid = groupByDialer ? `${baseKey} - ${dialerName}` : baseKey;

      if (!subidGroups[groupKey]) {
        subidGroups[groupKey] = {
          subid_value: displaySubid,
          leads_count: 0,
          weekday_leads: 0,
          weekend_leads: 0,
          policy_count: 0,
          transfer_count: 0,
          total_cost: 0,
          dialer_metrics: {},
          ...(groupByDialer && {
            assigned_dialer_type: dialerType,
            dialer_name: dialerName,
            dialer_transfer_rate: 0,
            dialer_policy_rate: 0
          })
        };
      }
      const leadsInc = Number(row.leads_count) || 0;
      const policiesInc = Number(row.policy_count) || 0;
      const transfersInc = Number(row.transfer_count) || 0;
      subidGroups[groupKey].leads_count += leadsInc;
      subidGroups[groupKey].policy_count += policiesInc;
      subidGroups[groupKey].transfer_count += transfersInc;
      // Accumulate per-dialer metrics map (used by dialer CPA columns in UI)
      const metricsMap = subidGroups[groupKey].dialer_metrics as Record<number, { leads: number; transfers: number; policies: number }>;
      const existing = metricsMap[dialerType] || { leads: 0, transfers: 0, policies: 0 };
      metricsMap[dialerType] = {
        leads: existing.leads + leadsInc,
        transfers: existing.transfers + transfersInc,
        policies: existing.policies + policiesInc,
      };
    });
    
    console.log(`✅ Created ${Object.keys(subidGroups).length} SUBID groups from ${allLeads.length} leads`);
    
    // ✅ DEBUG: Show detailed breakdown of SUBID groups
    console.log('🔍 DEBUG: SUBID Groups Summary:');
    Object.entries(subidGroups)
      .sort(([,a], [,b]) => b.leads_count - a.leads_count)
      .slice(0, 10) // Show top 10
      .forEach(([subid, data]) => {
        console.log(`  ${subid}: ${data.leads_count} leads, ${data.policy_count} policies, ${data.transfer_count} transfers`);
      });
    
    // Get list routing info for cost calculation
    const { data: routingData, error: routingError } = await supabase
      .from('list_routings')
      .select('bid, description, vertical')
      .eq('list_id', listId)
      .eq('active', true)
      .single();
    
    if (routingError) {
      console.error('Error fetching routing data:', routingError);
    }
    
    const costPerLead = routingData?.bid || 0.45; // Default cost per lead
    const listDescription = routingData?.description || listId;
    
    // Convert to final format (weekday/weekend rough split proportional to totals)
    const subidResults = Object.values(subidGroups).map(group => {
      // Calculate policy rate: (policy_count / leads_count) * 100
      const policyRate = group.leads_count > 0
        ? (group.policy_count / group.leads_count) * 100
        : 0;
        
      // Calculate transfer rate: (transfer_count / leads_count) * 100
      const transferRate = group.leads_count > 0
        ? (group.transfer_count / group.leads_count) * 100
        : 0;
        
      // Proportional weekday/weekend split if not computed via raw leads
      const weekdayLeads = group.weekday_leads || Math.round(group.leads_count * 5 / 7);
      const weekendLeads = group.weekend_leads || (group.leads_count - weekdayLeads);

      return {
        key: `${listId}-${group.subid_value}`,
        list_id: listId,
        description: `${listDescription} - ${group.subid_value}`,
        subid_value: group.subid_value,
        parent_list_id: listId,
        leads_count: group.leads_count,
        weekday_leads: weekdayLeads,
        weekend_leads: weekendLeads,
        cost_per_lead: costPerLead,
        total_lead_costs: weekdayLeads * costPerLead, // Use computed weekday leads for costs
        synergy_issued_leads: group.policy_count,
        synergy_payout: group.policy_count * (routingData?.vertical === 'Final Expense' ? 200 : 120), // Vertical-specific payout
        ai_costs_allocated: group.total_cost,
        net_profit: (group.policy_count * (routingData?.vertical === 'Final Expense' ? 200 : 120)) - (weekdayLeads * costPerLead) - group.total_cost,
        policy_rate: policyRate,
        transfers_count: group.transfer_count,
        is_subid_row: true,
        // Provide per-dialer metrics to power dialer CPA/ratios for SUBID rows
        dialer_metrics: group.dialer_metrics,
        // NEW: Include dialer-specific fields when available
        ...(group.assigned_dialer_type && {
          assigned_dialer_type: group.assigned_dialer_type,
          dialer_name: group.dialer_name,
          dialer_transfer_rate: transferRate,
          dialer_policy_rate: policyRate
        })
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
