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

async function processListForJuly(listId: string) {
  const year = 2025
  const month = 7
  const startDate = '2025-07-01'
  const endDate = '2025-07-31'

  console.log(`📊 Processing list ${listId} for July 2025`)

  // Get ALL leads for this list in July using pagination
  let allLeads: any[] = []
  let hasMore = true
  let offset = 0
  const fetchBatchSize = 5000 // Fetch 5K leads at a time from database

  while (hasMore) {
    const { data: leadBatch, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, first_name, last_name, email, created_at, list_id')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .range(offset, offset + fetchBatchSize - 1)
      .order('created_at', { ascending: true })

    if (leadsError) {
      console.error(`❌ Error fetching leads batch for ${listId}:`, leadsError)
      throw leadsError
    }

    if (leadBatch && leadBatch.length > 0) {
      allLeads.push(...leadBatch)
      offset += fetchBatchSize
      console.log(`📦 ${listId}: Got ${leadBatch.length} leads, total so far: ${allLeads.length}`)
      
      if (leadBatch.length < fetchBatchSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  if (allLeads.length === 0) {
    console.log(`📊 No leads found for ${listId} in July 2025`)
    return {
      listId,
      year,
      month,
      totalLeads: 0,
      dncMatches: 0,
      csvData: ''
    }
  }

  console.log(`📊 Found ${allLeads.length} total leads for ${listId}, checking DNC in batches...`)

  // Process leads in 1K batches for DNC checking
  let allDncResults: any[] = []
  const dncCheckBatchSize = 1000
  
  for (let i = 0; i < allLeads.length; i += dncCheckBatchSize) {
    const batch = allLeads.slice(i, i + dncCheckBatchSize)
    console.log(`🔍 ${listId}: DNC checking batch ${Math.floor(i / dncCheckBatchSize) + 1}: ${batch.length} leads`)
    
    // Check this batch for DNC compliance
    const batchResults = await Promise.all(
      batch.map(lead => checkRecordCompliance(lead))
    )
    
    allDncResults.push(...batchResults)
    console.log(`📋 ${listId}: Checked ${i + batch.length}/${allLeads.length} leads so far`)
  }

  // Get non-compliant (DNC) records from all batches
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

  console.log(`✅ ${listId}: ${dncRecords.length} DNCs out of ${allLeads.length} total leads`)

  return {
    listId,
    year,
    month,
    totalLeads: allLeads.length,
    dncMatches: dncRecords.length,
    csvData
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Generating July 2025 DNC exports for testing...')

    // Get all unique list IDs from July 2025
    const startDate = '2025-07-01'
    const endDate = '2025-07-31'

    const { data: listIds, error: listIdsError } = await supabase
      .from('leads')
      .select('list_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .not('list_id', 'is', null)

    if (listIdsError) {
      console.error('❌ Error fetching list IDs:', listIdsError)
      throw listIdsError
    }

    // Get unique list IDs
    const uniqueListIds = [...new Set(listIds?.map(l => l.list_id) || [])]
    console.log(`📋 Found ${uniqueListIds.length} unique list IDs to process for July 2025`)

    const results = []

    // Process each list ID
    for (const listId of uniqueListIds) {
      try {
        const result = await processListForJuly(listId)
        
        // Store the result in the database
        const { error: insertError } = await supabase
          .from('monthly_dnc_exports')
          .upsert({
            list_id: listId,
            year: 2025,
            month: 7,
            total_leads: result.totalLeads,
            dnc_matches: result.dncMatches,
            csv_data: result.csvData,
            processed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }, {
            onConflict: 'list_id,year,month'
          })

        if (insertError) {
          console.error(`❌ Error storing result for ${listId}:`, insertError)
          throw insertError
        }

        results.push(result)
        
      } catch (error) {
        console.error(`❌ Error processing ${listId}:`, error)
        results.push({
          listId,
          year: 2025,
          month: 7,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => !r.error).length
    const totalDncMatches = results.reduce((sum, r) => sum + (r.dncMatches || 0), 0)
    const totalLeads = results.reduce((sum, r) => sum + (r.totalLeads || 0), 0)

    console.log(`🎉 Completed July 2025 DNC export generation`)
    console.log(`📊 Processed ${successCount}/${uniqueListIds.length} lists successfully`)
    console.log(`📋 Total leads: ${totalLeads}, Total DNC matches: ${totalDncMatches}`)

    return NextResponse.json({
      success: true,
      message: `Generated July 2025 DNC exports for testing`,
      processedMonth: '2025-07',
      listsProcessed: successCount,
      totalLists: uniqueListIds.length,
      totalLeads,
      totalDncMatches,
      results
    })

  } catch (error) {
    console.error("❌ Error generating July DNC exports:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate July DNC exports",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
