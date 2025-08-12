import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Configuration for simple export (max 5k leads to avoid timeouts)
const BATCH_SIZE = 1000
const MAX_SIMPLE_EXPORT_LEADS = 5000
const TIMEOUT_MS = 30000 // 30 second timeout

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '')
  const month = parseInt(searchParams.get('month') || '')
  const listId = searchParams.get('list_id')
  const format = searchParams.get('format') || 'json'

  if (!year || !month || year < 2020 || year > 2030 || month < 1 || month > 12) {
    return NextResponse.json(
      { success: false, error: 'Valid year and month are required' },
      { status: 400 }
    )
  }

  try {
    console.log(`[SimpleMonthlyDNCExport] Starting export for ${year}-${month}${listId ? ` list ${listId}` : ''}`)
    
    const startDate = new Date(year, month - 1, 1).toISOString()
    const endDate = new Date(year, month, 1).toISOString()

    // Step 1: Get leads using cursor-based pagination
    const leadsResult = await getLeadsWithCursorPagination(startDate, endDate, listId)
    
    if (leadsResult.totalLeads > MAX_SIMPLE_EXPORT_LEADS) {
      return NextResponse.json({
        success: false,
        error: `Too many leads (${leadsResult.totalLeads}). Use the async export job API for large datasets.`,
        recommendation: 'POST /api/monthly-dnc-exports/export-job',
        max_simple_export_leads: MAX_SIMPLE_EXPORT_LEADS
      }, { status: 413 })
    }

    console.log(`[SimpleMonthlyDNCExport] Found ${leadsResult.totalLeads} leads across ${leadsResult.listStats.length} lists`)

    // Step 2: Check all leads against DNC lists
    const dncResults = await checkLeadsAgainstDNCLists(leadsResult.leads)
    
    // Step 3: Group results by list_id
    const listSummaries = await generateListSummaries(leadsResult.leads, dncResults, leadsResult.listStats)

    // Step 4: Return appropriate format
    if (format === 'csv') {
      const csvData = generateAggregatedCSV(listSummaries)
      const filename = `monthly-dnc-summary-${year}-${month.toString().padStart(2, '0')}.csv`
      
      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        total_leads: leadsResult.totalLeads,
        total_dnc_matches: dncResults.filter(r => r.isDNC).length,
        overall_dnc_rate: leadsResult.totalLeads > 0 ? 
          ((dncResults.filter(r => r.isDNC).length / leadsResult.totalLeads) * 100).toFixed(2) + '%' : '0%',
        lists: listSummaries,
        processing_time_ms: Date.now() - Date.parse(new Date().toISOString())
      }
    })

  } catch (error) {
    console.error('[SimpleMonthlyDNCExport] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process monthly DNC export' },
      { status: 500 }
    )
  }
}

// Cursor-based pagination to bypass 1k limits
async function getLeadsWithCursorPagination(
  startDate: string, 
  endDate: string, 
  targetListId?: string | null
): Promise<{
  leads: any[]
  totalLeads: number
  listStats: Array<{ list_id: string, count: number }>
}> {
  let allLeads: any[] = []
  let lastId: string | null = null
  let batchCount = 0
  const listCounts = new Map<string, number>()

  console.log(`[getLeadsWithCursorPagination] Fetching leads from ${startDate} to ${endDate}`)

  while (batchCount < 100) { // Safety limit for simple export
    try {
      let query = supabase
        .from('leads')
        .select('id, phone, first_name, last_name, email, list_id, created_at')
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .not('list_id', 'is', null)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (lastId) {
        query = query.gt('id', lastId)
      }

      if (targetListId) {
        query = query.eq('list_id', targetListId)
      }

      const { data: batchLeads, error } = await query

      if (error) {
        console.error('[getLeadsWithCursorPagination] Query error:', error)
        throw error
      }

      if (!batchLeads || batchLeads.length === 0) {
        console.log(`[getLeadsWithCursorPagination] No more leads found at batch ${batchCount}`)
        break
      }

      // Track counts per list_id
      batchLeads.forEach(lead => {
        if (lead.list_id) {
          listCounts.set(lead.list_id, (listCounts.get(lead.list_id) || 0) + 1)
        }
      })

      allLeads.push(...batchLeads)
      lastId = batchLeads[batchLeads.length - 1].id
      batchCount++

      console.log(`[getLeadsWithCursorPagination] Batch ${batchCount}: ${batchLeads.length} leads (total: ${allLeads.length})`)

      // Break if we got fewer leads than batch size (last batch)
      if (batchLeads.length < BATCH_SIZE) {
        break
      }

      // Safety check for simple export
      if (allLeads.length > MAX_SIMPLE_EXPORT_LEADS) {
        console.log(`[getLeadsWithCursorPagination] Reached max simple export limit: ${allLeads.length}`)
        break
      }

    } catch (error) {
      console.error(`[getLeadsWithCursorPagination] Error in batch ${batchCount}:`, error)
      break
    }
  }

  const listStats = Array.from(listCounts.entries()).map(([list_id, count]) => ({
    list_id,
    count
  }))

  return {
    leads: allLeads,
    totalLeads: allLeads.length,
    listStats
  }
}

// Check leads against DNC lists using existing checkers
async function checkLeadsAgainstDNCLists(leads: any[]): Promise<Array<{
  leadId: string
  phone: string
  isDNC: boolean
  dncSources: string[]
  details: any
}>> {
  console.log(`[checkLeadsAgainstDNCLists] Checking ${leads.length} leads against DNC lists`)
  
  const internalDNCChecker = new InternalDNCChecker()
  const synergyDNCChecker = new SynergyDNCChecker()
  
  const results: Array<{
    leadId: string
    phone: string
    isDNC: boolean
    dncSources: string[]
    details: any
  }> = []

  // Process leads in smaller batches to avoid overwhelming the DNC APIs
  const CONCURRENT_CHECKS = 10
  for (let i = 0; i < leads.length; i += CONCURRENT_CHECKS) {
    const batch = leads.slice(i, i + CONCURRENT_CHECKS)
    
    const batchPromises = batch.map(async (lead) => {
      const phone = lead.phone?.replace(/\D/g, '') // Normalize phone
      if (!phone || phone.length < 10) {
        return {
          leadId: lead.id,
          phone: lead.phone || '',
          isDNC: false,
          dncSources: [],
          details: { error: 'Invalid phone number' }
        }
      }

      try {
        // Check Internal DNC
        const internalResult = await internalDNCChecker.checkCompliance(phone)
        
        // Check Synergy DNC
        const synergyResult = await synergyDNCChecker.checkCompliance(phone)
        
        const dncSources: string[] = []
        let isDNC = false
        
        if (!internalResult.isCompliant) {
          isDNC = true
          dncSources.push('Internal DNC')
        }
        
        if (!synergyResult.isCompliant) {
          isDNC = true
          dncSources.push('Synergy DNC')
        }

        return {
          leadId: lead.id,
          phone: lead.phone || '',
          isDNC,
          dncSources,
          details: {
            internalDNC: internalResult,
            synergyDNC: synergyResult
          }
        }

      } catch (error) {
        console.error(`[checkLeadsAgainstDNCLists] Error checking lead ${lead.id}:`, error)
        return {
          leadId: lead.id,
          phone: lead.phone || '',
          isDNC: true, // Fail closed for safety
          dncSources: ['Error - Failed Closed'],
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Log progress
    if (i % 100 === 0) {
      console.log(`[checkLeadsAgainstDNCLists] Processed ${Math.min(i + CONCURRENT_CHECKS, leads.length)}/${leads.length} leads`)
    }
  }

  const dncCount = results.filter(r => r.isDNC).length
  console.log(`[checkLeadsAgainstDNCLists] Completed: ${dncCount}/${results.length} leads are DNC (${((dncCount/results.length)*100).toFixed(1)}%)`)
  
  return results
}

// Generate summaries grouped by list_id
async function generateListSummaries(
  leads: any[], 
  dncResults: Array<{ leadId: string, isDNC: boolean, dncSources: string[] }>,
  listStats: Array<{ list_id: string, count: number }>
) {
  const dncMap = new Map(dncResults.map(result => [result.leadId, result]))
  
  return listStats.map(stat => {
    const listLeads = leads.filter(lead => lead.list_id === stat.list_id)
    const listDNCMatches = listLeads.filter(lead => dncMap.get(lead.id)?.isDNC)
    const dncRate = stat.count > 0 ? ((listDNCMatches.length / stat.count) * 100).toFixed(2) : '0.00'
    
    return {
      list_id: stat.list_id,
      total_leads: stat.count,
      dnc_matches: listDNCMatches.length,
      dnc_rate: `${dncRate}%`,
      clean_leads: stat.count - listDNCMatches.length
    }
  }).sort((a, b) => b.total_leads - a.total_leads) // Sort by lead count descending
}

// Generate CSV for aggregated results
function generateAggregatedCSV(listSummaries: any[]): string {
  const headers = [
    'List ID',
    'Total Leads',
    'DNC Matches',
    'Clean Leads',
    'DNC Rate'
  ]

  const rows = listSummaries.map(summary => [
    summary.list_id,
    summary.total_leads.toString(),
    summary.dnc_matches.toString(),
    summary.clean_leads.toString(),
    summary.dnc_rate
  ])

  // Add totals row
  const totalLeads = listSummaries.reduce((sum, s) => sum + s.total_leads, 0)
  const totalDNC = listSummaries.reduce((sum, s) => sum + s.dnc_matches, 0)
  const totalClean = totalLeads - totalDNC
  const overallRate = totalLeads > 0 ? ((totalDNC / totalLeads) * 100).toFixed(2) + '%' : '0.00%'

  rows.push([
    'TOTAL',
    totalLeads.toString(),
    totalDNC.toString(),
    totalClean.toString(),
    overallRate
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n')
}
