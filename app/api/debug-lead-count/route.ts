import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging lead counts for July 2025...')

    const listId = 'pitch-bpo-list-1750372488308'
    const startDate = '2025-07-01'
    const endDate = '2025-07-31'

    // Method 1: Try to get count using Supabase count
    console.log('📊 Method 1: Using Supabase count...')
    const { count: totalCount, error: countError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')

    console.log(`Count result: ${totalCount}, error:`, countError)

    // Method 2: Try pagination with smaller batches to see where it stops
    console.log('📊 Method 2: Testing pagination step by step...')
    
    let testResults = []
    let offset = 0
    const batchSize = 1000
    
    for (let i = 0; i < 10; i++) { // Test first 10 batches
      const { data: batch, error: batchError } = await supabase
        .from('leads')
        .select('id, created_at')
        .eq('list_id', listId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59.999Z')
        .range(offset, offset + batchSize - 1)
        .order('created_at', { ascending: true })

      if (batchError) {
        console.error(`❌ Batch ${i + 1} error:`, batchError)
        break
      }

      const batchCount = batch?.length || 0
      testResults.push({
        batch: i + 1,
        offset_start: offset,
        offset_end: offset + batchSize - 1,
        returned_count: batchCount,
        has_data: batchCount > 0
      })

      console.log(`Batch ${i + 1}: offset ${offset}-${offset + batchSize - 1}, got ${batchCount} records`)
      
      offset += batchSize
      
      if (batchCount < batchSize) {
        console.log(`Stopping - batch ${i + 1} returned fewer than ${batchSize} records`)
        break
      }
    }

    // Method 3: Try without pagination, see what limit we hit
    console.log('📊 Method 3: Testing without pagination...')
    const { data: allData, error: allError } = await supabase
      .from('leads')
      .select('id')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .order('created_at', { ascending: true })

    console.log(`No pagination: got ${allData?.length || 0} records, error:`, allError)

    // Method 4: Check different date ranges to see if it's a date issue
    console.log('📊 Method 4: Testing different date ranges...')
    
    const dateTests = [
      { name: 'July 1-7', start: '2025-07-01', end: '2025-07-07' },
      { name: 'July 1-15', start: '2025-07-01', end: '2025-07-15' },
      { name: 'All July', start: '2025-07-01', end: '2025-07-31' },
      { name: 'All 2025', start: '2025-01-01', end: '2025-12-31' }
    ]

    const dateResults = []
    for (const test of dateTests) {
      const { count: dateCount, error: dateError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', listId)
        .gte('created_at', test.start)
        .lte('created_at', test.end + 'T23:59:59.999Z')

      dateResults.push({
        range: test.name,
        start_date: test.start,
        end_date: test.end,
        count: dateCount,
        error: dateError
      })

      console.log(`${test.name}: ${dateCount} leads`)
    }

    return NextResponse.json({
      success: true,
      listId,
      debug_results: {
        method_1_count: totalCount,
        method_1_error: countError,
        method_2_pagination: testResults,
        method_3_no_pagination: allData?.length || 0,
        method_3_error: allError,
        method_4_date_ranges: dateResults
      },
      summary: {
        likely_total_leads: totalCount,
        pagination_works: testResults.length > 1 && testResults.some(r => r.has_data),
        max_returned_without_pagination: allData?.length || 0
      }
    })

  } catch (error) {
    console.error("❌ Error debugging lead count:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to debug lead count",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
