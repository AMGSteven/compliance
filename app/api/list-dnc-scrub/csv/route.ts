import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const { list_id, start_date, end_date } = await request.json()

    if (!list_id || !start_date || !end_date) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'list_id, start_date, and end_date are required'
        },
        { status: 400 }
      )
    }

    console.log(`[List-DNC-CSV] Generating CSV for list ${list_id} from ${start_date} to ${end_date}`)

    // Step 1: Process ALL leads in 500-lead chunks using offset pagination (same as main API)
    const startDateTime = new Date(start_date + 'T00:00:00Z').toISOString()
    const endDateTime = new Date(end_date + 'T23:59:59Z').toISOString()

    console.log(`[List-DNC-CSV] Processing list ${list_id} in 500-lead chunks...`)
    
    const BATCH_SIZE = 500
    const MAX_BATCHES = 10000 // Safety limit (5M leads max)
    const internalDNCChecker = new InternalDNCChecker()
    
    let allResults: any[] = []
    let totalProcessed = 0
    let totalDNC = 0
    let batchNum = 0

    while (batchNum < MAX_BATCHES) {
      const offset = batchNum * BATCH_SIZE
      
      // Fetch 500 leads at a time
      const { data: batch, error } = await supabase
        .from('leads')
        .select('id, phone, first_name, last_name, email, list_id, created_at')
        .eq('list_id', list_id)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .order('created_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error(`[List-DNC-CSV] Error fetching batch ${batchNum + 1}:`, error)
        throw error
      }

      if (!batch || batch.length === 0) {
        console.log(`[List-DNC-CSV] No more leads found. Processed ${totalProcessed} total leads.`)
        break
      }

      batchNum++
      console.log(`[List-DNC-CSV] Processing batch ${batchNum}: ${batch.length} leads (offset: ${offset})`)

      // Extract phone numbers for bulk DNC checking
      const phoneNumbers = batch
        .map((lead: any) => lead.phone?.replace(/\D/g, ''))
        .filter((phone: any) => phone && phone.length >= 10)

      if (phoneNumbers.length === 0) {
        console.log(`[List-DNC-CSV] No valid phone numbers in batch ${batchNum}, skipping DNC check`)
        continue
      }

      // Bulk check against internal DNC
      const dncResults = await internalDNCChecker.bulkCheckNumbers(phoneNumbers)
      
      // Process each lead in the batch
      for (const lead of batch) {
        totalProcessed++
        const cleanPhone = lead.phone?.replace(/\D/g, '')
        
        let isDNC = false
        let dncReasons: string[] = []
        let dncSources: string[] = []
        
        if (cleanPhone && cleanPhone.length >= 10) {
          const dncResult = dncResults.get(cleanPhone)
          if (dncResult && !dncResult.isCompliant) {
            isDNC = true
            totalDNC++
            dncReasons = dncResult.reasons || []
            dncSources = dncResult.source ? [dncResult.source] : []
          }
        }
        
        allResults.push({
          lead_id: lead.id,
          phone: lead.phone,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          created_at: lead.created_at,
          is_dnc: isDNC,
          dnc_status: isDNC ? 'DNC' : 'Clean',
          dnc_reasons: dncReasons,
          dnc_sources: dncSources
        })
      }
    }

    // Step 2: Generate CSV
    const csvData = generateCSV(allResults, list_id, start_date, end_date)
    const filename = `dnc-scrub-${list_id}-${start_date}-${end_date}.csv`
    
    console.log(`[List-DNC-CSV] Generated CSV with ${allResults.length} leads, ${totalDNC} DNCs`)

    return new Response(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('[List-DNC-CSV] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate CSV',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function generateCSV(results: any[], listId: string, startDate: string, endDate: string): string {
  // Filter to only include DNC leads
  const dncLeads = results.filter(r => r.is_dnc)
  
  const headers = [
    'Lead ID',
    'Phone',
    'First Name',
    'Last Name',
    'Email',
    'Created At',
    'DNC Status',
    'DNC Sources',
    'DNC Reasons'
  ]

  const rows = dncLeads.map(lead => [
    lead.lead_id,
    lead.phone,
    lead.first_name || '',
    lead.last_name || '',
    lead.email || '',
    lead.created_at,
    lead.dnc_status,
    lead.dnc_sources.join('; '),
    lead.dnc_reasons.join('; ')
  ])

  // Calculate stats
  const totalLeads = results.length
  const totalDncLeads = dncLeads.length
  const cleanLeads = totalLeads - totalDncLeads
  const dncRate = totalLeads > 0 ? ((totalDncLeads / totalLeads) * 100).toFixed(1) + '%' : '0%'

  // Main DNC leads section
  const mainSection = [
    `# List DNC Scrub Report - DNC LEADS ONLY`,
    `# List ID: ${listId}`,
    `# Date Range: ${startDate} to ${endDate}`,
    `# Total Leads Processed: ${totalLeads}`,
    `# DNC Leads (Exported): ${totalDncLeads}`,
    `# Clean Leads (Not Exported): ${cleanLeads}`,
    `# DNC Rate: ${dncRate}`,
    `# Processed with 500-batch Internal DNC checking`,
    `#`,
    headers.join(','),
    ...rows.map(row => row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(','))
  ]

  // Return reason section
  const returnReasonHeaders = ['Lead ID', 'Phone', 'return_reason']
  const returnReasonRows = dncLeads.map(lead => [
    lead.lead_id,
    lead.phone,
    'User claims to not have opted in - DNC'
  ])

  const returnReasonSection = [
    '',
    '',
    `# RETURN REASON TAB`,
    `# All DNC leads with standardized return reason`,
    `#`,
    returnReasonHeaders.join(','),
    ...returnReasonRows.map(row => row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(','))
  ]

  const csvContent = [...mainSection, ...returnReasonSection].join('\n')
  return csvContent
}
