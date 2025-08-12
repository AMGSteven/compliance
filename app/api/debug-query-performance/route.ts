import { type NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const listId = 'pitch-bpo-list-1750372488308'
    const startDate = '2025-07-01'
    const endDate = '2025-07-31'

    console.log('🔍 Testing query performance step by step...')

    // Test 1: Simple count without date filter
    console.log('📊 Test 1: Count all leads for list (no date filter)...')
    const start1 = Date.now()
    const { count: countAll, error: error1 } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
    
    const time1 = Date.now() - start1
    console.log(`Count all: ${countAll}, took ${time1}ms, error:`, error1)

    // Test 2: Count with date filter
    console.log('📊 Test 2: Count with date filter...')
    const start2 = Date.now()
    const { count: countFiltered, error: error2 } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
    
    const time2 = Date.now() - start2
    console.log(`Count filtered: ${countFiltered}, took ${time2}ms, error:`, error2)

    // Test 3: Fetch just 10 records without ordering
    console.log('📊 Test 3: Fetch 10 records (no ordering)...')
    const start3 = Date.now()
    const { data: data3, error: error3 } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .limit(10)
    
    const time3 = Date.now() - start3
    console.log(`Fetch 10 unordered: ${data3?.length}, took ${time3}ms, error:`, error3)

    // Test 4: Fetch 10 records WITH ordering (this might be the slow part)
    console.log('📊 Test 4: Fetch 10 records WITH ID ordering...')
    const start4 = Date.now()
    const { data: data4, error: error4 } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .order('id', { ascending: true })
      .limit(10)
    
    const time4 = Date.now() - start4
    console.log(`Fetch 10 ordered: ${data4?.length}, took ${time4}ms, error:`, error4)

    // Test 5: Alternative - try ordering by created_at instead
    console.log('📊 Test 5: Fetch 10 records ordered by created_at...')
    const start5 = Date.now()
    const { data: data5, error: error5 } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('list_id', listId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z')
      .order('created_at', { ascending: true })
      .limit(10)
    
    const time5 = Date.now() - start5
    console.log(`Fetch 10 by created_at: ${data5?.length}, took ${time5}ms, error:`, error5)

    // Test 6: Try with a much smaller date range
    console.log('📊 Test 6: Fetch 10 records for just one day...')
    const start6 = Date.now()
    const { data: data6, error: error6 } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('list_id', listId)
      .gte('created_at', '2025-07-01')
      .lte('created_at', '2025-07-01T23:59:59.999Z')
      .order('id', { ascending: true })
      .limit(10)
    
    const time6 = Date.now() - start6
    console.log(`Fetch 10 one day: ${data6?.length}, took ${time6}ms, error:`, error6)

    return NextResponse.json({
      success: true,
      listId,
      performance_tests: {
        test_1_count_all: { count: countAll, time_ms: time1, error: error1 },
        test_2_count_filtered: { count: countFiltered, time_ms: time2, error: error2 },
        test_3_fetch_unordered: { count: data3?.length, time_ms: time3, error: error3 },
        test_4_fetch_ordered_by_id: { count: data4?.length, time_ms: time4, error: error4 },
        test_5_fetch_ordered_by_created_at: { count: data5?.length, time_ms: time5, error: error5 },
        test_6_fetch_one_day: { count: data6?.length, time_ms: time6, error: error6 }
      },
      diagnosis: {
        likely_slow_operation: time4 > 5000 ? "ORDER BY id" : 
                             time5 > 5000 ? "ORDER BY created_at" :
                             time2 > 5000 ? "Date filtering" :
                             time1 > 5000 ? "List ID filtering" : "Unknown",
        recommended_approach: time6 < 1000 ? "Process by smaller date ranges" : 
                            time3 < 1000 ? "Avoid ordering, use different pagination" :
                            "Need database optimization"
      }
    })

  } catch (error) {
    console.error("❌ Error in performance test:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Performance test failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
