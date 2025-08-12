import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import { InternalDNCChecker } from '@/lib/compliance/checkers/internal-dnc-checker'
import { SynergyDNCChecker } from '@/lib/compliance/checkers/synergy-dnc-checker'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRecordCompliance(record: any) {
  const result = {
    record,
    isCompliant: true,
    failureReasons: [] as string[],
  }

  try {
    const phone = record.phone || record.Phone || record.phone_number || record.PhoneNumber || ''
    
    if (!phone) {
      result.isCompliant = false
      result.failureReasons.push('Missing phone number')
      return result
    }

    // Check Internal DNC
    const internalDNCChecker = new InternalDNCChecker()
    const internalDNCResult = await internalDNCChecker.checkNumber(phone)
    
    if (!internalDNCResult.isCompliant) {
      result.isCompliant = false
      const reasons = internalDNCResult.reasons || ['Found in Internal DNC list']
      result.failureReasons.push(...reasons)
    }

    // Check Synergy DNC  
    const synergyDNCChecker = new SynergyDNCChecker()
    const synergyDNCResult = await synergyDNCChecker.checkNumber(phone)
    
    if (!synergyDNCResult.isCompliant) {
      result.isCompliant = false
      const reasons = synergyDNCResult.reasons || ['Found in Synergy DNC list']
      result.failureReasons.push(...reasons)
    }

  } catch (error) {
    console.error('Error checking record compliance:', error)
    result.isCompliant = false
    result.failureReasons.push('Error during compliance check')
  }

  return result
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = ['phone_number', 'return_reason', 'first_name', 'last_name', 'email', 'lead_created_at', 'list_id']
  const csvLines = [headers.join(',')]
  
  data.forEach(record => {
    const values = headers.map(header => {
      const value = record[header] || ''
      return `"${value.toString().replace(/"/g, '""')}"`
    })
    csvLines.push(values.join(','))
  })
  
  return csvLines.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Testing July 2025 processing with ALL leads...')

    const listId = 'pitch-bpo-list-1750372488308'
    const startDate = '2025-07-01'
    const endDateStr = '2025-07-31'

    console.log(`📊 Processing list ${listId} for July 2025 (${startDate} to ${endDateStr})`)

    // SOLUTION: Process July in DAILY CHUNKS to avoid query timeouts
    let allLeads: any[] = []
    const daysInJuly = 31
    
    console.log(`📅 Processing July 2025 in daily chunks to avoid timeouts...`)

    for (let day = 1; day <= daysInJuly; day++) {
      const dayStr = day.toString().padStart(2, '0')
      const dayStart = `2025-07-${dayStr}T00:00:00.000Z`
      const dayEnd = `2025-07-${dayStr}T23:59:59.999Z`
      
      console.log(`📅 Processing day ${day}/31: ${dayStr} July 2025...`)
      
      // Use cursor-based pagination for this single day
      let dayLeads: any[] = []
      let lastId: number | null = null
      const batchSize = 1000 // Can use larger batches for single day
      let batchCount = 0
      const maxBatches = 100 // Safety limit per day
      
      while (batchCount < maxBatches) {
        let batchQuery = supabase
          .from('leads')
          .select('id, phone, first_name, last_name, email')
          .eq('list_id', listId)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('id', { ascending: true })
          .limit(batchSize)

        // Use cursor for pagination
        if (lastId !== null) {
          batchQuery = batchQuery.gt('id', lastId)
        }

        const { data: leadBatch, error: leadsError } = await batchQuery

        if (leadsError) {
          console.error(`❌ Error fetching day ${day} batch ${batchCount + 1}:`, leadsError)
          throw leadsError
        }

        if (!leadBatch || leadBatch.length === 0) {
          console.log(`🏁 Day ${day}: No more leads, stopping at batch ${batchCount + 1}`)
          break
        }

        dayLeads.push(...leadBatch)
        lastId = leadBatch[leadBatch.length - 1].id
        batchCount++
        
        console.log(`📦 Day ${day}, Batch ${batchCount}: ${leadBatch.length} leads, day total: ${dayLeads.length}`)
        
        if (leadBatch.length < batchSize) {
          console.log(`🏁 Day ${day}: Last batch (${leadBatch.length} < ${batchSize})`)
          break
        }
      }
      
      allLeads.push(...dayLeads)
      console.log(`✅ Day ${day} complete: ${dayLeads.length} leads (total so far: ${allLeads.length})`)
      
      // Small delay between days
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const leads = allLeads

    if (!leads || leads.length === 0) {
      console.log(`📊 No leads found for ${listId} in July 2025`)
      return NextResponse.json({
        success: true,
        message: 'No leads found',
        totalLeads: 0,
        dncMatches: 0
      })
    }

    console.log(`📊 Found ${leads.length} total leads for ${listId}, checking DNC in batches...`)

    // Process leads in 1K batches for DNC checking
    let allDncResults: any[] = []
    const dncCheckBatchSize = 1000
    
    for (let i = 0; i < leads.length; i += dncCheckBatchSize) {
      const batch = leads.slice(i, i + dncCheckBatchSize)
      const batchNum = Math.floor(i / dncCheckBatchSize) + 1
      const totalBatches = Math.ceil(leads.length / dncCheckBatchSize)
      
      console.log(`🔍 Processing DNC batch ${batchNum}/${totalBatches}: ${batch.length} leads`)
      
      const batchResults = await Promise.all(
        batch.map(lead => checkRecordCompliance(lead))
      )
      
      allDncResults.push(...batchResults)
      console.log(`📋 Processed ${i + batch.length}/${leads.length} leads so far`)
    }

    // Get non-compliant (DNC) records
    const dncRecords = allDncResults
      .filter((r: any) => !r.isCompliant)
      .map((r: any) => ({
        phone_number: r.record.phone,
        return_reason: 'user claimed to never have opted in',
        first_name: r.record.first_name || '',
        last_name: r.record.last_name || '',
        email: r.record.email || '',
        lead_created_at: r.record.created_at,
        list_id: r.record.list_id
      }))

    const csvData = convertToCSV(dncRecords)

    console.log(`✅ ${listId}: ${dncRecords.length} DNCs out of ${leads.length} total leads`)

    // Store in database
    console.log('💾 Storing results in monthly_dnc_exports...')
    
    const { error: insertError } = await supabase
      .from('monthly_dnc_exports')
      .upsert({
        list_id: listId,
        year: 2025,
        month: 7,
        total_leads: leads.length,
        dnc_matches: dncRecords.length,
        csv_data: csvData,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'list_id,year,month'
      })

    if (insertError) {
      console.error(`❌ Error storing result for ${listId}:`, insertError)
      throw insertError
    }

    console.log('🎉 COMPLETE! July 2025 processing with ALL leads')

    return NextResponse.json({
      success: true,
      message: `Processed ALL leads for July 2025`,
      listId,
      totalLeads: leads.length,
      dncMatches: dncRecords.length,
      dncRate: ((dncRecords.length / leads.length) * 100).toFixed(2) + '%',
      csvDataLength: csvData.length
    })

  } catch (error) {
    console.error("❌ Error processing July leads:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process July leads",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
