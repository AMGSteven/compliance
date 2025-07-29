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

// Type definition for the processing performance SQL function result
interface ProcessingPerformanceResult {
  processing_date: string;
  list_id: string;
  description: string;
  total_processed: string;
  same_day_processed: string;
  cross_day_processed: string;
  avg_processing_delay_hours: string;
  generation_date_breakdown: any;
  processing_efficiency_score: string;
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
    const processingType = searchParams.get('processingType') || 'transfers'; // 'transfers' or 'policies'
    const listIds = searchParams.get('listIds')?.split(',').filter(Boolean);

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`⚡ Processing Performance Metrics API called:`, {
      startDate,
      endDate,
      processingType,
      listIds: listIds?.length || 'all',
    });

    // Call the new SQL function for processing performance metrics
    const { data: results, error } = await supabase.rpc('get_processing_performance_metrics', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_processing_type: processingType,
      p_list_ids: listIds || null
    });

    if (error) {
      console.error('❌ Error calling get_processing_performance_metrics:', error);
      return NextResponse.json(
        { success: false, error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Calculate totals with proper typing
    const typedResults = results as ProcessingPerformanceResult[] || [];
    const totalProcessed = typedResults.reduce((sum: number, item: ProcessingPerformanceResult) => sum + parseInt(item.total_processed), 0);
    const totalSameDayProcessed = typedResults.reduce((sum: number, item: ProcessingPerformanceResult) => sum + parseInt(item.same_day_processed || '0'), 0);
    const totalCrossDayProcessed = typedResults.reduce((sum: number, item: ProcessingPerformanceResult) => sum + parseInt(item.cross_day_processed || '0'), 0);
    const avgDelayHours = typedResults.length > 0 ? 
      typedResults.reduce((sum: number, item: ProcessingPerformanceResult) => sum + parseFloat(item.avg_processing_delay_hours || '0'), 0) / typedResults.length : 0;

    const response = {
      success: true,
      data: typedResults,
      metadata: {
        query_type: 'processing_performance_metrics',
        processing_type: processingType,
        date_range: { start: startDate, end: endDate },
        timezone: 'America/New_York (EST)',
        lists_analyzed: typedResults.length,
        totals: {
          total_processed: totalProcessed,
          same_day_processed: totalSameDayProcessed,
          cross_day_processed: totalCrossDayProcessed,
          same_day_percentage: totalProcessed > 0 ? 
            parseFloat(((totalSameDayProcessed / totalProcessed) * 100).toFixed(2)) : 0,
          cross_day_percentage: totalProcessed > 0 ? 
            parseFloat(((totalCrossDayProcessed / totalProcessed) * 100).toFixed(2)) : 0,
          avg_processing_delay_hours: parseFloat(avgDelayHours.toFixed(2)),
          processing_efficiency: totalProcessed > 0 ? 
            parseFloat(((totalSameDayProcessed / totalProcessed) * 100).toFixed(2)) : 0
        },
        explanation: `These metrics show ${processingType} processing performance based on actual processing dates, revealing temporal disconnects from lead generation`
      }
    };

    console.log(`✅ Processing Performance: ${totalProcessed} ${processingType} processed, ${totalSameDayProcessed} same-day (${response.metadata.totals.same_day_percentage}%)`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Unexpected error in processing performance metrics API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 