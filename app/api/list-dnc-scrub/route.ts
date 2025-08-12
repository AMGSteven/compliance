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

    console.log(`[List-DNC-Scrub] Starting batch scrub for list ${list_id} from ${start_date} to ${end_date}`)

    // Step 1: Process ALL leads in 500-lead chunks using offset pagination
    const startDateTime = new Date(start_date + 'T00:00:00Z').toISOString()
    const endDateTime = new Date(end_date + 'T23:59:59Z').toISOString()

    console.log(`[List-DNC-Scrub] Processing list ${list_id} in 500-lead chunks...`)
    
    const BATCH_SIZE = 500
    const MAX_BATCHES = 10000 // Safety limit (5M leads max)
    const internalDNCChecker = new InternalDNCChecker()
    
    let allResults = []
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
        console.error(`[List-DNC-Scrub] Error fetching batch ${batchNum + 1}:`, error)
        throw error
      }

      if (!batch || batch.length === 0) {
        console.log(`[List-DNC-Scrub] No more leads found. Processed ${totalProcessed} total leads.`)
        break
      }

      batchNum++
      console.log(`[List-DNC-Scrub] Processing batch ${batchNum}: ${batch.length} leads (offset: ${offset})`)

      // Extract phone numbers for bulk DNC checking
      const phoneNumbers = batch
        .map(lead => lead.phone?.replace(/\D/g, ''))
        .filter(phone => phone && phone.length >= 10)

      // Bulk check this batch against internal DNC
      const bulkResults = await internalDNCChecker.bulkCheckNumbers(phoneNumbers)

      // Process each lead in this batch
      for (const lead of batch) {
        const phone = lead.phone?.replace(/\D/g, '')
        let isDNC = false
        let dncReasons = []
        let dncSources = []

        if (!phone || phone.length < 10) {
          allResults.push({
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

        // Check bulk results for this phone
        const dncResult = bulkResults.get(phone)
        if (dncResult && !dncResult.isCompliant) {
          isDNC = true
          dncSources.push('Internal DNC')
          dncReasons.push(...(dncResult.reasons || ['Internal DNC match']))
          totalDNC++
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

      totalProcessed += batch.length
      console.log(`[List-DNC-Scrub] Batch ${batchNum} complete: ${batch.length} leads processed (total: ${totalProcessed}, DNC: ${totalDNC})`)

      // If we got less than BATCH_SIZE, we're done
      if (batch.length < BATCH_SIZE) {
        console.log(`[List-DNC-Scrub] Last batch processed (${batch.length} < ${BATCH_SIZE})`)
        break
      }
    }

    if (totalProcessed === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads found for the specified criteria',
        data: {
          list_id,
          date_range: `${start_date} to ${end_date}`,
          total_leads: 0,
          dnc_leads: 0,
          clean_leads: 0,
          dnc_rate: '0%',
          leads: []
        }
      })
    }

    const cleanCount = totalProcessed - totalDNC
    const dncRate = totalProcessed > 0 ? ((totalDNC / totalProcessed) * 100).toFixed(1) + '%' : '0%'

    console.log(`[List-DNC-Scrub] COMPLETE: ${totalDNC}/${totalProcessed} leads are DNC (${dncRate})`)

    // Step 2: Return results - Return data directly to match frontend expectations
    return NextResponse.json({
      list_id,
      date_range: `${start_date} to ${end_date}`,
      total_leads: totalProcessed,
      total_dnc_matches: totalDNC,  // Frontend expects this name
      clean_leads: cleanCount,
      overall_dnc_rate: dncRate,    // Frontend expects this name
      lists: allResults
    })

  } catch (error) {
    console.error('[List-DNC-Scrub] Error:', error)
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
