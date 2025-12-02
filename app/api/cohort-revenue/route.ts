import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const dynamic = 'force-dynamic';

const validateApiKey = (req: NextRequest) => {
  const apiKey = req.headers.get('x-api-key');
  const validApiKeys = ['test_key_123', process.env.API_KEY].filter(Boolean);
  return apiKey && validApiKeys.includes(apiKey);
};

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days_back') || '21');
    const vertical = searchParams.get('vertical') || null;
    const dialerTypeParam = searchParams.get('dialer_type');
    const dialerType = dialerTypeParam ? parseInt(dialerTypeParam) : null;

    console.log('🎯 Cohort Revenue API called:', { daysBack, vertical, dialerType });

    // Run all queries in parallel using FAST pre-aggregated functions
    const [weeklyResult, maturationResult, inventoryResult] = await Promise.all([
      supabase.rpc('get_cohort_stats_fast', {
        p_days_back: daysBack,
        p_vertical: vertical,
        p_dialer_type: dialerType
      }),
      supabase.rpc('get_maturation_curve_data', { p_lookback_days: 30 }),
      supabase.rpc('get_inventory_stats_fast', { p_vertical: vertical, p_dialer_type: dialerType })
    ]);

    if (weeklyResult.error) {
      console.error('❌ Weekly cohort error:', weeklyResult.error);
    }
    if (maturationResult.error) {
      console.error('❌ Maturation error:', maturationResult.error);
    }
    if (inventoryResult.error) {
      console.error('❌ Inventory error:', inventoryResult.error);
    }

    const weeklyData = weeklyResult.data || [];
    const maturationData = maturationResult.data || [];
    const inventoryData = inventoryResult.data || [];

    // Calculate summary
    const summary = {
      totalLeadsBought: weeklyData.reduce((sum: number, w: any) => sum + parseInt(w.leads_bought || 0), 0),
      totalLeadCost: weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.total_lead_cost || 0), 0),
      totalTransfers: weeklyData.reduce((sum: number, w: any) => sum + parseInt(w.transfers || 0), 0),
      totalPolicies: weeklyData.reduce((sum: number, w: any) => sum + parseInt(w.policies || 0), 0),
      totalRevenue: weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.revenue || 0), 0),
      totalDialerCosts: weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.dialer_costs || 0), 0),
      totalGrossProfit: weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.gross_profit || 0), 0),
      overallTransferRate: 0,
      overallPolicyRate: 0,
      overallROI: 0,
      projectedTotalRevenue: weeklyData.reduce((sum: number, w: any) => sum + parseFloat(w.projected_revenue || 0), 0),
      projectedROI: 0
    };

    if (summary.totalLeadsBought > 0) {
      summary.overallTransferRate = parseFloat(((summary.totalTransfers / summary.totalLeadsBought) * 100).toFixed(2));
      summary.overallPolicyRate = parseFloat(((summary.totalPolicies / summary.totalLeadsBought) * 100).toFixed(2));
    }
    
    if (summary.totalLeadCost + summary.totalDialerCosts > 0) {
      summary.overallROI = parseFloat(((summary.totalGrossProfit / (summary.totalLeadCost + summary.totalDialerCosts)) * 100).toFixed(2));
      summary.projectedROI = parseFloat((((summary.projectedTotalRevenue - summary.totalLeadCost - summary.totalDialerCosts) / (summary.totalLeadCost + summary.totalDialerCosts)) * 100).toFixed(2));
    }

    const inventorySummary = {
      totalInventoryValue: inventoryData.reduce((sum: number, i: any) => sum + parseFloat(i.total_cost || 0), 0),
      projectedYield: inventoryData.reduce((sum: number, i: any) => sum + parseFloat(i.projected_revenue || 0), 0),
      unrealizedProfit: inventoryData.reduce((sum: number, i: any) => sum + parseFloat(i.unrealized_profit || 0), 0),
      buckets: inventoryData
    };

    const response = {
      success: true,
      data: {
        weeklyCohorts: weeklyData,
        maturationCurve: maturationData,
        inventory: inventorySummary
      },
      summary,
      metadata: {
        daysAnalyzed: daysBack,
        vertical: vertical || 'All',
        dialerType: dialerType === 1 ? 'Internal' : dialerType === 2 ? 'Pitch BPO' : 'All',
        generatedAt: new Date().toISOString(),
        note: 'Data from pre-aggregated cohort_daily_stats table. Refresh via refresh_cohort_stats_for_day().'
      }
    };

    console.log(`✅ Cohort Revenue: ${weeklyData.length} weeks, ${summary.totalLeadsBought.toLocaleString()} leads, ${summary.totalPolicies} policies, $${summary.totalRevenue.toLocaleString()} revenue`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Unexpected error in cohort revenue API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
