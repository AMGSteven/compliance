import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    
    if (!jobId) {
      return NextResponse.json({ error: 'job_id parameter is required' }, { status: 400 });
    }
    
    const { data: job, error } = await supabase
      .from('leads_export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error) {
      console.error('Error fetching job status:', error);
      return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
    }
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: job.id,
      status: job.status,
      total_leads: job.total_leads,
      exported_leads: job.exported_leads,
      progress_percentage: job.progress_percentage,
      error_message: job.error_message,
      file_url: job.file_url,
      started_at: job.started_at,
      completed_at: job.completed_at,
      created_at: job.created_at,
      updated_at: job.updated_at
    });
    
  } catch (error) {
    console.error('Error in status endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to get job status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
