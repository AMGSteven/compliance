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

// Type definition for the SQL function result
interface LeadGenerationResult {
  generation_date: string;
  list_id: string;
  description: string;
  total_generated: string;
  cost_incurred: string;
  subid_breakdown: any;
  eventual_transfers: string;
  eventual_policies: string;
  eventual_transfer_rate: string;
  eventual_policy_rate: string;
  avg_hours_to_transfer: string;
  avg_hours_to_policy: string;
}

export async function GET(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const listIds = searchParams.get('listIds')?.split(',').filter(Boolean);

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`🎯 Lead Generation Metrics API called:`, {
      startDate,
      endDate,
      listIds: listIds?.length || 'all',
    });

    // Call the new SQL function for lead generation metrics
    const { data: results, error } = await supabase.rpc('get_lead_generation_metrics', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_list_ids: listIds || null
    });

    if (error) {
      console.error('❌ Error calling get_lead_generation_metrics:', error);
      return NextResponse.json(
        { success: false, error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Calculate totals with proper typing
    const typedResults = results as LeadGenerationResult[] || [];
    const totalLeadsGenerated = typedResults.reduce((sum: number, item: LeadGenerationResult) => sum + parseInt(item.total_generated), 0);
    const totalCostIncurred = typedResults.reduce((sum: number, item: LeadGenerationResult) => sum + parseFloat(item.cost_incurred || '0'), 0);
    const totalEventualTransfers = typedResults.reduce((sum: number, item: LeadGenerationResult) => sum + parseInt(item.eventual_transfers || '0'), 0);
    const totalEventualPolicies = typedResults.reduce((sum: number, item: LeadGenerationResult) => sum + parseInt(item.eventual_policies || '0'), 0);

    const response = {
      success: true,
      data: typedResults,
      metadata: {
        query_type: 'lead_generation_metrics',
        date_range: { start: startDate, end: endDate },
        timezone: 'America/New_York (EST)',
        lists_analyzed: typedResults.length,
        totals: {
          leads_generated: totalLeadsGenerated,
          cost_incurred: totalCostIncurred,
          eventual_transfers: totalEventualTransfers,
          eventual_policies: totalEventualPolicies,
          eventual_transfer_rate: totalLeadsGenerated > 0 ? 
            parseFloat(((totalEventualTransfers / totalLeadsGenerated) * 100).toFixed(2)) : 0,
          eventual_policy_rate: totalLeadsGenerated > 0 ? 
            parseFloat(((totalEventualPolicies / totalLeadsGenerated) * 100).toFixed(2)) : 0,
          cost_per_lead: totalLeadsGenerated > 0 ? 
            parseFloat((totalCostIncurred / totalLeadsGenerated).toFixed(2)) : 0,
          cost_per_transfer: totalEventualTransfers > 0 ? 
            parseFloat((totalCostIncurred / totalEventualTransfers).toFixed(2)) : 0,
          cost_per_policy: totalEventualPolicies > 0 ? 
            parseFloat((totalCostIncurred / totalEventualPolicies).toFixed(2)) : 0,
        },
        explanation: "These metrics show lead generation performance based on creation_date, with eventual processing outcomes tracked cross-temporally"
      }
    };

    console.log(`✅ Lead Generation Metrics: ${totalLeadsGenerated} leads generated, ${totalEventualTransfers} eventually transferred`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Unexpected error in lead generation metrics API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 