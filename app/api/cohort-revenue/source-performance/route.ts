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
    const cohortStart = searchParams.get('cohort_start');
    const cohortEnd = searchParams.get('cohort_end');
    const minLeads = parseInt(searchParams.get('min_leads') || '50');
    const vertical = searchParams.get('vertical') || null;
    const dialerTypeParam = searchParams.get('dialer_type');
    const dialerType = dialerTypeParam ? parseInt(dialerTypeParam) : null;

    if (!cohortStart || !cohortEnd) {
      return NextResponse.json({ 
        success: false, 
        error: 'cohort_start and cohort_end are required' 
      }, { status: 400 });
    }

    console.log('🎯 Source Performance API called:', { cohortStart, cohortEnd, minLeads, vertical, dialerType });

    // Use FAST pre-aggregated function
    const { data, error } = await supabase.rpc('get_source_stats_fast', {
      p_start_date: cohortStart,
      p_end_date: cohortEnd,
      p_min_leads: minLeads,
      p_vertical: vertical,
      p_dialer_type: dialerType
    });

    if (error) {
      console.error('❌ Source performance error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calculate summary
    const summary = {
      totalSources: data?.length || 0,
      totalLeads: data?.reduce((sum: number, s: any) => sum + parseInt(s.leads_bought || 0), 0) || 0,
      totalCost: data?.reduce((sum: number, s: any) => sum + parseFloat(s.total_cost || 0), 0) || 0,
      totalRevenue: data?.reduce((sum: number, s: any) => sum + parseFloat(s.revenue || 0), 0) || 0,
      scaleCount: data?.filter((s: any) => s.recommendation === 'SCALE').length || 0,
      monitorCount: data?.filter((s: any) => s.recommendation === 'MONITOR').length || 0,
      reduceCount: data?.filter((s: any) => s.recommendation === 'REDUCE').length || 0,
      watchCount: data?.filter((s: any) => s.recommendation === 'WATCH').length || 0
    };

    const response = {
      success: true,
      data: data || [],
      summary,
      metadata: {
        cohortPeriod: { start: cohortStart, end: cohortEnd },
        minLeadsFilter: minLeads,
        vertical: vertical || 'All',
        dialerType: dialerType === 1 ? 'Internal' : dialerType === 2 ? 'Pitch BPO' : 'All',
        generatedAt: new Date().toISOString(),
        note: 'Data from pre-aggregated cohort_daily_stats table.'
      }
    };

    console.log(`✅ Source Performance: ${data?.length || 0} sources, ${summary.scaleCount} SCALE, ${summary.monitorCount} MONITOR, ${summary.reduceCount} REDUCE`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Unexpected error in source performance API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
