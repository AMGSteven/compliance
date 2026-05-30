import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  
  try {
    // Get total count first
    const { count: totalCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Starting async export of ${totalCount || 0} leads...`);
    
    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('leads_export_jobs')
      .insert({
        status: 'pending',
        total_leads: totalCount || 0,
        exported_leads: 0,
        progress_percentage: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (jobError) {
      console.error('Error creating job:', jobError);
      return NextResponse.json({ error: 'Failed to create export job' }, { status: 500 });
    }
    
    // Start processing in background (non-blocking)
    processExportJob(job.id, totalCount || 0);
    
    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Export job started',
      total_leads: totalCount
    });
    
  } catch (error) {
    console.error('Error starting export job:', error);
    return NextResponse.json(
      { error: 'Failed to start export job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function processExportJob(jobId: string, totalCount: number) {
  const supabase = createServerClient();
  
  try {
    // Update status to running
    await supabase
      .from('leads_export_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', jobId);
    
    // Generate CSV content
    const headers = [
      'id',
      'first_name',
      'last_name',
      'email',
      'phone',
      'zip_code',
      'state',
      'city',
      'address',
      'status',
      'created_at',
      'list_id',
      'campaign_id',
      'traffic_source',
      'source',
      'vertical',
      'sub_id',
      'partner_name',
      'list_description'
    ];
    
    let csvContent = headers.join(',') + '\n';
    let lastId = '';
    let exportedCount = 0;
    const batchSize = 1000;
    const maxBatches = 5000; // Safety limit to prevent infinite loops
    let batchCount = 0;
    
    while (batchCount < maxBatches) {
      // Query leads with cursor-based pagination
      let query = supabase
        .from('leads')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          zip_code,
          state,
          city,
          address,
          status,
          created_at,
          list_id,
          campaign_id,
          traffic_source,
          source,
          vertical,
          sub_id,
          list_routings!left (
            partner_name,
            description
          )
        `)
        .order('id', { ascending: true })
        .limit(batchSize);
      
      if (lastId) {
        query = query.gt('id', lastId);
      }
      
      const { data: leads, error } = await query;
      
      if (error) {
        console.error('Error fetching leads:', error);
        throw error;
      }
      
      if (!leads || leads.length === 0) {
        break;
      }
      
      // Process batch
      for (const lead of leads as any) {
        const row = [
          lead.id || '',
          escapeCSV(lead.first_name || ''),
          escapeCSV(lead.last_name || ''),
          escapeCSV(lead.email || ''),
          escapeCSV(lead.phone || ''),
          escapeCSV(lead.zip_code || ''),
          escapeCSV(lead.state || ''),
          escapeCSV(lead.city || ''),
          escapeCSV(lead.address || ''),
          escapeCSV(lead.status || ''),
          lead.created_at || '',
          escapeCSV(lead.list_id || ''),
          escapeCSV(lead.campaign_id || ''),
          escapeCSV(lead.traffic_source || ''),
          escapeCSV(lead.source || ''),
          escapeCSV(lead.vertical || ''),
          escapeCSV(lead.sub_id || ''),
          escapeCSV(lead.list_routings?.partner_name || ''),
          escapeCSV(lead.list_routings?.description || '')
        ];
        
        csvContent += row.join(',') + '\n';
        exportedCount++;
        lastId = lead.id;
      }
      
      batchCount++;
      
      // Update progress every 10 batches
      if (batchCount % 10 === 0) {
        const progress = Math.round((exportedCount / totalCount) * 100);
        await supabase
          .from('leads_export_jobs')
          .update({
            exported_leads: exportedCount,
            progress_percentage: progress,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);
        
        console.log(`Export progress: ${exportedCount}/${totalCount} (${progress}%)`);
      }
      
      // If we got fewer than batchSize, we're done
      if (leads.length < batchSize) {
        break;
      }
    }
    
    // Upload CSV to Supabase Storage (or generate a download URL)
    // For now, we'll store the CSV as a base64 string in the database
    // In production, you'd want to use Supabase Storage or S3
    const fileUrl = `data:text/csv;base64,${Buffer.from(csvContent).toString('base64')}`;
    
    // Update job as completed
    await supabase
      .from('leads_export_jobs')
      .update({
        status: 'completed',
        exported_leads: exportedCount,
        progress_percentage: 100,
        file_url: fileUrl,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`Export complete: ${exportedCount} leads exported`);
    
  } catch (error) {
    console.error('Error during export:', error);
    
    // Update job as failed
    await supabase
      .from('leads_export_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

function escapeCSV(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
