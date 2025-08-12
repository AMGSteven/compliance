import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'Job ID is required' },
      { status: 400 }
    )
  }

  try {
    const { data: job, error } = await supabase
      .from('monthly_dnc_export_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json(
        { success: false, error: 'Export job not found' },
        { status: 404 }
      )
    }

    // Calculate estimated time remaining based on progress
    let estimatedTimeRemaining = null
    if (job.status === 'running' && job.started_at && job.progress > 0) {
      const elapsed = Date.now() - new Date(job.started_at).getTime()
      const progressRatio = job.progress / 100
      const totalEstimated = elapsed / progressRatio
      estimatedTimeRemaining = Math.max(0, totalEstimated - elapsed)
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        year: job.year,
        month: job.month,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error_message: job.error_message,
        total_lists_processed: job.total_lists_processed,
        total_leads_found: job.total_leads_found,
        total_dnc_matches: job.total_dnc_matches,
        estimated_time_remaining_ms: estimatedTimeRemaining,
        estimated_time_remaining_formatted: estimatedTimeRemaining ? 
          formatDuration(estimatedTimeRemaining) : null
      }
    })

  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m remaining`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s remaining`
  } else {
    return `${seconds}s remaining`
  }
}
