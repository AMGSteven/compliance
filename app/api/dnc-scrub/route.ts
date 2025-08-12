import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const listId = searchParams.get('list_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const format = searchParams.get('format') || 'json'

  if (!listId || !startDate || !endDate) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'list_id, start_date, and end_date are required',
        example: '/api/dnc-scrub?list_id=abc123&start_date=2025-07-01&end_date=2025-07-31'
      },
      { status: 400 }
    )
  }

  try {
    console.log(`[DNC-Scrub] Starting scrub for list ${listId} from ${startDate} to ${endDate}`)

    // Step 1: Get all leads for this list ID in the date range
    const startDateTime = new Date(startDate + 'T00:00:00Z').toISOString()
    const endDateTime = new Date(endDate + 'T23:59:59Z').toISOString()

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, first_name, last_name, email, list_id, created_at')
      .eq('list_id', listId)
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime)
      .order('created_at', { ascending: true })

    if (leadsError) {
      console.error('[DNC-Scrub] Error fetching leads:', leadsError)
      throw leadsError
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads found for the specified criteria',
        data: {
          list_id: listId,
          date_range: `${startDate} to ${endDate}`,
          total_leads: 0,
          dnc_leads: 0,
          clean_leads: 0,
          dnc_rate: '0%',
          leads: []
        }
      })
    }

    console.log(`[DNC-Scrub] Found ${leads.length} leads, checking against DNC lists...`)

    // Step 2: Check each lead against DNC lists
    const internalDNCChecker = new InternalDNCChecker()
    const synergyDNCChecker = new SynergyDNCChecker()

    const results = []
    let dncCount = 0

    for (const lead of leads) {
      const phone = lead.phone?.replace(/\D/g, '') // Normalize phone
      let isDNC = false
      let dncReasons = []
      let dncSources = []

      if (!phone || phone.length < 10) {
        results.push({
          lead_id: lead.id,
          phone: lead.phone,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          created_at: lead.created_at,
          is_dnc: false,
          dnc_status: 'Invalid Phone',
          dnc_reasons: ['Invalid or missing phone number'],
          dnc_sources: []
        })
        continue
      }

      try {
        // Check Internal DNC
        const internalResult = await internalDNCChecker.checkNumber(phone)
        if (!internalResult.isCompliant) {
          isDNC = true
          dncSources.push('Internal DNC')
          dncReasons.push(...(internalResult.reasons || ['Internal DNC match']))
        }

        // Check Synergy DNC
        const synergyResult = await synergyDNCChecker.checkNumber(phone)
        if (!synergyResult.isCompliant) {
          isDNC = true
          dncSources.push('Synergy DNC')
          dncReasons.push(...(synergyResult.reasons || ['Synergy DNC match']))
        }

      } catch (error) {
        console.error(`[DNC-Scrub] Error checking phone ${phone}:`, error)
        // Fail closed for safety
        isDNC = true
        dncSources.push('Error Check')
        dncReasons.push('DNC check failed - blocked for safety')
      }

      if (isDNC) {
        dncCount++
      }

      results.push({
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

    const cleanCount = leads.length - dncCount
    const dncRate = leads.length > 0 ? ((dncCount / leads.length) * 100).toFixed(1) + '%' : '0%'

    console.log(`[DNC-Scrub] Completed: ${dncCount}/${leads.length} leads are DNC (${dncRate})`)

    // Step 3: Return results
    const responseData = {
      list_id: listId,
      date_range: `${startDate} to ${endDate}`,
      total_leads: leads.length,
      dnc_leads: dncCount,
      clean_leads: cleanCount,
      dnc_rate: dncRate,
      leads: results
    }

    if (format === 'csv') {
      const csvData = generateCSV(results, listId, startDate, endDate)
      const filename = `dnc-scrub-${listId}-${startDate}-${endDate}.csv`
      
      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('[DNC-Scrub] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process DNC scrub',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function generateCSV(results: any[], listId: string, startDate: string, endDate: string): string {
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

  const rows = results.map(lead => [
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

  // Add summary at the top
  const totalLeads = results.length
  const dncLeads = results.filter(r => r.is_dnc).length
  const cleanLeads = totalLeads - dncLeads
  const dncRate = totalLeads > 0 ? ((dncLeads / totalLeads) * 100).toFixed(1) + '%' : '0%'

  const csvContent = [
    `# DNC Scrub Report`,
    `# List ID: ${listId}`,
    `# Date Range: ${startDate} to ${endDate}`,
    `# Total Leads: ${totalLeads}`,
    `# DNC Leads: ${dncLeads}`,
    `# Clean Leads: ${cleanLeads}`,
    `# DNC Rate: ${dncRate}`,
    `#`,
    headers.join(','),
    ...rows.map(row => row.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  return csvContent
}
