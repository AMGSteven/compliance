import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Export job processing configuration
const BATCH_SIZE = 1000
const MAX_BATCHES = 1000 // Safety limit to prevent infinite loops

// Simplified job tracking using in-memory status for now
const jobStatuses = new Map<string, {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  year: number
  month: number
  created_at: string
  completed_at?: string
  error_message?: string
  total_lists_processed?: number
  total_leads_found?: number
  total_dnc_matches?: number
}>()

export async function POST(request: NextRequest) {
  const { year, month, list_ids } = await request.json()

  if (!year || !month) {
    return NextResponse.json(
      { success: false, error: 'Year and month are required' },
      { status: 400 }
    )
  }

  try {
    // Create export job record in memory for now
    const jobId = `dnc-export-${year}-${month}-${Date.now()}`
    
    const job = {
      id: jobId,
      status: 'pending' as const,
      progress: 0,
      year,
      month,
      created_at: new Date().toISOString()
    }
    
    jobStatuses.set(jobId, job)
    
    console.log(`[AsyncDNCExport] Created job ${jobId} for ${year}-${month}`)

    // Start background processing (don't await - let it run async)
    processMonthlyDNCExportDirectly(jobId, year, month, list_ids)

    return NextResponse.json({
      success: true,
      job_id: jobId,
      message: 'Export job started successfully',
      status_url: `/api/monthly-dnc-exports/export-job/status?job_id=${jobId}`
    })

  } catch (error) {
    console.error('Error starting monthly DNC export:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to start export job' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  if (!jobId) {
    // Return list of recent jobs
    const recentJobs = Array.from(jobStatuses.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
    
    return NextResponse.json({
      success: true,
      jobs: recentJobs
    })
  }

  try {
    const job = jobStatuses.get(jobId)

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Export job not found' },
        { status: 404 }
      )
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
        completed_at: job.completed_at,
        error_message: job.error_message,
        total_lists_processed: job.total_lists_processed,
        total_leads_found: job.total_leads_found,
        total_dnc_matches: job.total_dnc_matches
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

// Background processing function using cursor-based pagination (direct version)
async function processMonthlyDNCExportDirectly(
  jobId: string, 
  year: number, 
  month: number, 
  targetListIds?: string[]
) {
  console.log(`[processMonthlyDNCExportDirectly] Starting job ${jobId} for ${year}-${month}`)
  
  try {
    // Update job status to running in memory
    const job = jobStatuses.get(jobId)
    if (job) {
      job.status = 'running'
      job.progress = 5
      jobStatuses.set(jobId, job)
    }

    // Step 1: Get all unique list_ids for the month (10% progress)
    const listIds = await getUniqueListIds(year, month, targetListIds)
    console.log(`[processMonthlyDNCExportDirectly] Found ${listIds.length} unique list IDs`)
    
    if (job) {
      job.progress = 10
      jobStatuses.set(jobId, job)
    }

    // Step 2: Process each list_id with cursor-based pagination (10-90% progress)
    const results: Array<{
      list_id: string
      total_leads: number
      dnc_matches: number
      dnc_rate: string
      csv_data: string
    }> = []

    let processedLists = 0
    const totalLists = listIds.length

    for (const listId of listIds) {
      console.log(`[processMonthlyDNCExportDirectly] Processing list ${listId} (${processedLists + 1}/${totalLists})`)
      
      try {
        const listResult = await processListWithCursorPagination(listId, year, month, jobId)
        results.push(listResult)
        
        processedLists++
        const progress = Math.min(90, 10 + Math.floor((processedLists * 80) / totalLists))
        
        if (job) {
          job.progress = progress
          job.total_lists_processed = processedLists
          jobStatuses.set(jobId, job)
        }

      } catch (error) {
        console.error(`[processMonthlyDNCExportDirectly] Error processing list ${listId}:`, error)
        // Continue with other lists even if one fails
      }
    }

    // Step 3: Save results to monthly_dnc_exports table (90-95% progress)
    console.log(`[processMonthlyDNCExportDirectly] Saving ${results.length} results to database`)
    
    for (const result of results) {
      await supabase
        .from('monthly_dnc_exports')
        .upsert({
          list_id: result.list_id,
          year,
          month,
          total_leads: result.total_leads,
          dnc_matches: result.dnc_matches,
          csv_data: result.csv_data,
          processed_at: new Date().toISOString()
        }, {
          onConflict: 'list_id,year,month'
        })
    }

    if (job) {
      job.progress = 95
      jobStatuses.set(jobId, job)
    }

    // Step 4: Calculate totals and complete job (95-100% progress)
    const totalLeads = results.reduce((sum, r) => sum + r.total_leads, 0)
    const totalDncMatches = results.reduce((sum, r) => sum + r.dnc_matches, 0)

    if (job) {
      job.status = 'completed'
      job.progress = 100
      job.completed_at = new Date().toISOString()
      job.total_lists_processed = results.length
      job.total_leads_found = totalLeads
      job.total_dnc_matches = totalDncMatches
      jobStatuses.set(jobId, job)
    }

    console.log(`[processMonthlyDNCExportDirectly] Job ${jobId} completed successfully`)
    console.log(`  - Lists processed: ${results.length}`)
    console.log(`  - Total leads: ${totalLeads}`)
    console.log(`  - Total DNC matches: ${totalDncMatches}`)

  } catch (error) {
    console.error(`[processMonthlyDNCExportDirectly] Job ${jobId} failed:`, error)
    
    const job = jobStatuses.get(jobId)
    if (job) {
      job.status = 'failed'
      job.error_message = error instanceof Error ? error.message : 'Unknown error'
      job.completed_at = new Date().toISOString()
      jobStatuses.set(jobId, job)
    }
  }
}

// Get unique list_ids for the specified month using cursor pagination
async function getUniqueListIds(
  year: number, 
  month: number, 
  targetListIds?: string[]
): Promise<string[]> {
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 1).toISOString()
  
  let allListIds = new Set<string>()
  let lastId: string | null = null
  let batchCount = 0

  console.log(`[getUniqueListIds] Fetching unique list IDs for ${year}-${month}`)

  while (batchCount < MAX_BATCHES) {
    try {
      let query = supabase
        .from('leads')
        .select('id, list_id')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .not('list_id', 'is', null)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (lastId) {
        query = query.gt('id', lastId)
      }

      if (targetListIds && targetListIds.length > 0) {
        query = query.in('list_id', targetListIds)
      }

      const { data: batchLeads, error } = await query

      if (error) {
        console.error('[getUniqueListIds] Query error:', error)
        throw error
      }

      if (!batchLeads || batchLeads.length === 0) {
        console.log(`[getUniqueListIds] No more leads found at batch ${batchCount}`)
        break
      }

      // Add unique list_ids to set
      batchLeads.forEach(lead => {
        if (lead.list_id) {
          allListIds.add(lead.list_id)
        }
      })

      // Update cursor for next batch
      if (batchLeads.length > 0 && batchLeads[batchLeads.length - 1].id) {
        lastId = batchLeads[batchLeads.length - 1].id
      }
      batchCount++

      console.log(`[getUniqueListIds] Batch ${batchCount}: Found ${batchLeads.length} leads, ${allListIds.size} unique list IDs so far`)

      // Break if we got fewer leads than batch size (last batch)
      if (batchLeads.length < BATCH_SIZE) {
        break
      }

    } catch (error) {
      console.error(`[getUniqueListIds] Error in batch ${batchCount}:`, error)
      break
    }
  }

  const uniqueListIds = Array.from(allListIds)
  console.log(`[getUniqueListIds] Completed: ${uniqueListIds.length} unique list IDs found`)
  
  return uniqueListIds
}

// Process a single list_id with cursor-based pagination to bypass 1k limits
async function processListWithCursorPagination(
  listId: string,
  year: number,
  month: number,
  jobId: string
): Promise<{
  list_id: string
  total_leads: number
  dnc_matches: number
  dnc_rate: string
  csv_data: string
}> {
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 1).toISOString()
  
  let allLeads: any[] = []
  let lastId: string | null = null
  let batchCount = 0

  console.log(`[processListWithCursorPagination] Processing list ${listId} for ${year}-${month}`)

  // Cursor-based pagination to bypass 1k limit
  while (batchCount < MAX_BATCHES) {
    try {
      let batchQuery = supabase
        .from('leads')
        .select('id, phone, first_name, last_name, email, created_at, list_id')
        .eq('list_id', listId)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (lastId) {
        batchQuery = batchQuery.gt('id', lastId)
      }

      const { data: batchLeads, error } = await batchQuery

      if (error) {
        console.error(`[processListWithCursorPagination] Query error for list ${listId}:`, error)
        throw error
      }

      if (!batchLeads || batchLeads.length === 0) {
        console.log(`[processListWithCursorPagination] No more leads for list ${listId} at batch ${batchCount}`)
        break
      }

      allLeads.push(...batchLeads)
      if (batchLeads.length > 0 && batchLeads[batchLeads.length - 1].id) {
        lastId = batchLeads[batchLeads.length - 1].id
      }
      batchCount++

      console.log(`[processListWithCursorPagination] List ${listId} batch ${batchCount}: ${batchLeads.length} leads (total: ${allLeads.length})`)

      // Break if we got fewer leads than batch size (last batch)
      if (batchLeads.length < BATCH_SIZE) {
        break
      }

      // Safety check
      if (batchCount > MAX_BATCHES) {
        console.log(`[processListWithCursorPagination] Safety limit reached for list ${listId} at batch ${batchCount}`)
        break
      }

    } catch (error) {
      console.error(`[processListWithCursorPagination] Error in batch ${batchCount} for list ${listId}:`, error)
      break
    }
  }

  console.log(`[processListWithCursorPagination] List ${listId} completed: ${allLeads.length} total leads found`)

  // Check which leads are on DNC lists using real DNC checkers
  const dncMatches = await checkLeadsAgainstDNCReal(allLeads)
  const dncCount = dncMatches.filter(match => match.isDNC).length
  const dncRate = allLeads.length > 0 ? ((dncCount / allLeads.length) * 100).toFixed(2) : '0.00'

  // Generate CSV data
  const csvData = generateCSVData(allLeads, dncMatches)

  return {
    list_id: listId,
    total_leads: allLeads.length,
    dnc_matches: dncCount,
    dnc_rate: `${dncRate}%`,
    csv_data: csvData
  }
}

// Real DNC checking using existing infrastructure
async function checkLeadsAgainstDNCReal(leads: any[]): Promise<Array<{ leadId: string, isDNC: boolean, reason?: string }>> {
  console.log(`[checkLeadsAgainstDNCReal] Checking ${leads.length} leads against DNC lists`)
  
  const internalDNCChecker = new InternalDNCChecker()
  const synergyDNCChecker = new SynergyDNCChecker()
  
  const results: Array<{ leadId: string, isDNC: boolean, reason?: string }> = []

  // Process leads in smaller batches to avoid overwhelming the DNC APIs
  const batchSize = 10
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (lead) => {
      const phone = lead.phone?.replace(/\D/g, '') // Normalize phone
      if (!phone || phone.length < 10) {
        return {
          leadId: lead.id,
          isDNC: false,
          reason: 'Invalid phone number'
        }
      }

      try {
        // Check Internal DNC
        const internalResult = await internalDNCChecker.checkNumber(phone)
        
        // Check Synergy DNC
        const synergyResult = await synergyDNCChecker.checkNumber(phone)
        
        if (!internalResult.isCompliant) {
          return {
            leadId: lead.id,
            isDNC: true,
            reason: 'Internal DNC'
          }
        }
        
        if (!synergyResult.isCompliant) {
          return {
            leadId: lead.id,
            isDNC: true,
            reason: 'Synergy DNC'
          }
        }

        return {
          leadId: lead.id,
          isDNC: false
        }

      } catch (error) {
        console.error(`[checkLeadsAgainstDNCReal] Error checking lead ${lead.id}:`, error)
        // Fail closed for safety
        return {
          leadId: lead.id,
          isDNC: true,
          reason: 'Error - Failed Closed'
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Add small delay between batches to be respectful to DNC APIs
    if (i + batchSize < leads.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const dncCount = results.filter(r => r.isDNC).length
  console.log(`[checkLeadsAgainstDNCReal] Completed: ${dncCount}/${results.length} leads are DNC (${((dncCount/results.length)*100).toFixed(1)}%)`)
  
  return results
}

// Generate CSV data for the results
function generateCSVData(leads: any[], dncMatches: Array<{ leadId: string, isDNC: boolean, reason?: string }>): string {
  const dncMap = new Map(dncMatches.map(match => [match.leadId, match]))
  
  const headers = [
    'Lead ID',
    'Phone',
    'First Name', 
    'Last Name',
    'Email',
    'List ID',
    'Created At',
    'DNC Status',
    'DNC Reason'
  ]

  const rows = leads.map(lead => {
    const dncInfo = dncMap.get(lead.id)
    return [
      lead.id,
      lead.phone,
      lead.first_name,
      lead.last_name, 
      lead.email,
      lead.list_id,
      lead.created_at,
      dncInfo?.isDNC ? 'DNC' : 'Clean',
      dncInfo?.reason || ''
    ].map(field => `"${(field || '').toString().replace(/"/g, '""')}"`)
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}
