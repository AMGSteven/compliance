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

async function processListForMonth(listId: string, year: number, month: number) {
  // Generate date range for the month
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0) // Last day of month
  const endDateStr = `${year}-${month.toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`

  console.log(`📊 Processing list ${listId} for ${year}-${month} (${startDate} to ${endDateStr})`)

  // PROVEN SOLUTION: Process month in DAILY CHUNKS to avoid query timeouts
  let allLeads: any[] = []
  const daysInMonth = new Date(year, month, 0).getDate() // Get days in month
  
  console.log(`📅 Processing ${year}-${month} in daily chunks (${daysInMonth} days) for ${listId}...`)

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = day.toString().padStart(2, '0')
    const monthStr = month.toString().padStart(2, '0')
    const dayStart = `${year}-${monthStr}-${dayStr}T00:00:00.000Z`
    const dayEnd = `${year}-${monthStr}-${dayStr}T23:59:59.999Z`
    
    console.log(`📅 Processing day ${day}/${daysInMonth}: ${dayStr} ${monthStr} ${year}...`)
    
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
        console.error(`❌ Error fetching ${listId} day ${day} batch ${batchCount + 1}:`, leadsError)
        throw leadsError
      }

      if (!leadBatch || leadBatch.length === 0) {
        console.log(`🏁 ${listId} day ${day}: No more leads, stopping at batch ${batchCount + 1}`)
        break
      }

      dayLeads.push(...leadBatch)
      lastId = leadBatch[leadBatch.length - 1].id
      batchCount++
      
      console.log(`📦 ${listId} day ${day}, batch ${batchCount}: ${leadBatch.length} leads, day total: ${dayLeads.length}`)
      
      if (leadBatch.length < batchSize) {
        console.log(`🏁 ${listId} day ${day}: Last batch (${leadBatch.length} < ${batchSize})`)
        break
      }
    }
    
    allLeads.push(...dayLeads)
    console.log(`✅ ${listId} day ${day} complete: ${dayLeads.length} leads (total so far: ${allLeads.length})`)
    
    // Small delay between days
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const leads = allLeads

  if (!leads || leads.length === 0) {
    console.log(`📊 No leads found for ${listId} in ${year}-${month}`)
    return {
      listId,
      year,
      month,
      totalLeads: 0,
      dncMatches: 0,
      csvData: ''
    }
  }

  console.log(`📊 Found ${leads.length} leads for ${listId}, checking DNC...`)

  // Check each lead for DNC compliance
  const results = await Promise.all(
    leads.map(lead => checkRecordCompliance(lead))
  )

  // Get non-compliant (DNC) records
  const dncRecords = results
    .filter(r => !r.isCompliant)
    .map(r => ({
      phone_number: r.record.phone,
      return_reason: 'user claimed to never have opted in',
      first_name: r.record.first_name || '',
      last_name: r.record.last_name || '',
      email: r.record.email || '',
      lead_created_at: r.record.created_at,
      list_id: r.record.list_id
    }))

  const csvData = convertToCSV(dncRecords)

  console.log(`✅ ${listId}: ${dncRecords.length} DNCs out of ${leads.length} leads`)

  return {
    listId,
    year,
    month,
    totalLeads: leads.length,
    dncMatches: dncRecords.length,
    csvData
  }
}

export async function GET(request: NextRequest) {
  // Verify the cron secret
  const authHeader = request.headers.get("authorization")
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log('🚀 Starting monthly DNC export processing...')

    // Calculate previous month
    const now = new Date()
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    console.log(`📅 Processing DNC exports for ${prevYear}-${prevMonth}`)

    // Get all unique list IDs from the previous month
    const startDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`
    const endDate = new Date(prevYear, prevMonth, 0)
    const endDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`

    const { data: listIds, error: listIdsError } = await supabase
      .from('leads')
      .select('list_id')
      .gte('created_at', startDate)
      .lte('created_at', endDateStr + 'T23:59:59.999Z')
      .not('list_id', 'is', null)

    if (listIdsError) {
      console.error('❌ Error fetching list IDs:', listIdsError)
      throw listIdsError
    }

    // Get unique list IDs
    const uniqueListIds = [...new Set(listIds?.map(l => l.list_id) || [])]
    console.log(`📋 Found ${uniqueListIds.length} unique list IDs to process`)

    const results = []

    // Process each list ID
    for (const listId of uniqueListIds) {
      try {
        const result = await processListForMonth(listId, prevYear, prevMonth)
        
        // Store the result in the database
        const { error: insertError } = await supabase
          .from('monthly_dnc_exports')
          .upsert({
            list_id: listId,
            year: prevYear,
            month: prevMonth,
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
          year: prevYear,
          month: prevMonth,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => !r.error).length
    const totalDncMatches = results.reduce((sum, r) => sum + (r.dncMatches || 0), 0)
    const totalLeads = results.reduce((sum, r) => sum + (r.totalLeads || 0), 0)

    console.log(`🎉 Completed monthly DNC export processing`)
    console.log(`📊 Processed ${successCount}/${uniqueListIds.length} lists successfully`)
    console.log(`📋 Total leads: ${totalLeads}, Total DNC matches: ${totalDncMatches}`)

    return NextResponse.json({
      success: true,
      message: `Processed monthly DNC exports for ${prevYear}-${prevMonth}`,
      processedMonth: `${prevYear}-${prevMonth}`,
      listsProcessed: successCount,
      totalLists: uniqueListIds.length,
      totalLeads,
      totalDncMatches,
      results
    })

  } catch (error) {
    console.error("❌ Error in monthly DNC export cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process monthly DNC exports",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
