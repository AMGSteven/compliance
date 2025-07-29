import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Validate API key middleware
const validateApiKey = (req: NextRequest) => {
  const apiKey = req.headers.get('x-api-key');
  
  // Accept known API keys - in production these should be stored securely
  const validApiKeys = ['test_key_123', process.env.API_KEY].filter(Boolean);
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    console.log('API key validation failed:', { provided: apiKey });
    return false;
  }
  
  return true;
};

// Type definition for the cohort attribution SQL function result
interface CohortAttributionResult {
  generation_date: string;
  list_id: string;
  description: string;
  leads_generated: string;
  transfers_to_date: string;
  policies_to_date: string;
  transfer_rate: string;
  policy_rate: string;
  avg_days_to_transfer: string;
  avg_days_to_policy: string;
  processing_lag_distribution: {
    same_day: number;
    next_day: number;
    multi_day: number;
    never_processed: number;
  };
  cohort_maturity_days: number;
  revenue_to_date: string;
}

export async function GET(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const generationStartDate = searchParams.get('generationStartDate');
    const generationEndDate = searchParams.get('generationEndDate');
    const analysisCutoffDate = searchParams.get('analysisCutoffDate') || new Date().toISOString().split('T')[0];

    // Validate required parameters
    if (!generationStartDate || !generationEndDate) {
      return NextResponse.json(
        { success: false, error: 'generationStartDate and generationEndDate are required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Cohort Attribution Analysis API called:`, {
      generationStartDate,
      generationEndDate,
      analysisCutoffDate,
      cohortMaturityDays: Math.floor((new Date(analysisCutoffDate).getTime() - new Date(generationStartDate).getTime()) / (1000 * 60 * 60 * 24))
    });

    // Call the new SQL function for cohort attribution analysis
    const { data: results, error } = await supabase.rpc('get_cohort_attribution_analysis', {
      p_generation_start: generationStartDate,
      p_generation_end: generationEndDate,
      p_analysis_cutoff_date: analysisCutoffDate
    });

    if (error) {
      console.error('❌ Error calling get_cohort_attribution_analysis:', error);
      return NextResponse.json(
        { success: false, error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Calculate totals with proper typing
    const typedResults = results as CohortAttributionResult[] || [];
    const totalLeadsGenerated = typedResults.reduce((sum: number, item: CohortAttributionResult) => sum + parseInt(item.leads_generated), 0);
    const totalTransfersToDate = typedResults.reduce((sum: number, item: CohortAttributionResult) => sum + parseInt(item.transfers_to_date || '0'), 0);
    const totalPoliciesToDate = typedResults.reduce((sum: number, item: CohortAttributionResult) => sum + parseInt(item.policies_to_date || '0'), 0);
    const totalRevenueToDate = typedResults.reduce((sum: number, item: CohortAttributionResult) => sum + parseFloat(item.revenue_to_date || '0'), 0);

    // Aggregate processing lag distribution
    const aggregatedLagDistribution = typedResults.reduce(
      (acc, item: CohortAttributionResult) => {
        const lag = item.processing_lag_distribution;
        return {
          same_day: acc.same_day + (lag?.same_day || 0),
          next_day: acc.next_day + (lag?.next_day || 0),
          multi_day: acc.multi_day + (lag?.multi_day || 0),
          never_processed: acc.never_processed + (lag?.never_processed || 0),
        };
      },
      { same_day: 0, next_day: 0, multi_day: 0, never_processed: 0 }
    );

    const response = {
      success: true,
      data: typedResults,
      metadata: {
        query_type: 'cohort_attribution_analysis',
        generation_period: { start: generationStartDate, end: generationEndDate },
        analysis_cutoff_date: analysisCutoffDate,
        timezone: 'America/New_York (EST)',
        cohorts_analyzed: typedResults.length,
        totals: {
          leads_generated: totalLeadsGenerated,
          transfers_to_date: totalTransfersToDate,
          policies_to_date: totalPoliciesToDate,
          revenue_to_date: totalRevenueToDate,
          overall_transfer_rate: totalLeadsGenerated > 0 ? 
            parseFloat(((totalTransfersToDate / totalLeadsGenerated) * 100).toFixed(2)) : 0,
          overall_policy_rate: totalLeadsGenerated > 0 ? 
            parseFloat(((totalPoliciesToDate / totalLeadsGenerated) * 100).toFixed(2)) : 0,
          cost_per_transfer: totalTransfersToDate > 0 ? 
            parseFloat((totalRevenueToDate / totalTransfersToDate).toFixed(2)) : 0,
          cost_per_policy: totalPoliciesToDate > 0 ? 
            parseFloat((totalRevenueToDate / totalPoliciesToDate).toFixed(2)) : 0,
        },
        processing_lag_analysis: {
          ...aggregatedLagDistribution,
          same_day_percentage: totalTransfersToDate > 0 ? 
            parseFloat(((aggregatedLagDistribution.same_day / totalTransfersToDate) * 100).toFixed(2)) : 0,
          next_day_percentage: totalTransfersToDate > 0 ? 
            parseFloat(((aggregatedLagDistribution.next_day / totalTransfersToDate) * 100).toFixed(2)) : 0,
          multi_day_percentage: totalTransfersToDate > 0 ? 
            parseFloat(((aggregatedLagDistribution.multi_day / totalTransfersToDate) * 100).toFixed(2)) : 0,
          never_processed_percentage: totalLeadsGenerated > 0 ? 
            parseFloat(((aggregatedLagDistribution.never_processed / totalLeadsGenerated) * 100).toFixed(2)) : 0,
        },
        explanation: "This cohort analysis tracks leads from their generation date to eventual processing outcomes, solving the temporal attribution problem by showing true conversion performance over time"
      }
    };

    console.log(`✅ Cohort Attribution: ${totalLeadsGenerated} leads generated → ${totalTransfersToDate} transfers (${response.metadata.totals.overall_transfer_rate}%) → ${totalPoliciesToDate} policies (${response.metadata.totals.overall_policy_rate}%)`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Unexpected error in cohort attribution analysis API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 