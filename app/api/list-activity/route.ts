import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { start_date, end_date } = await request.json()

    if (!start_date || !end_date) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'start_date and end_date are required'
        },
        { status: 400 }
      )
    }

    console.log(`🔍 [List-Activity] Getting list activity from ${start_date} to ${end_date} using revenue tracking approach`)
    const supabase = createServerClient()
    const startTime = Date.now()

    // STEP 1: Get all active list routings (same as revenue tracking)
    console.log('📋 Fetching active list routings...')
    const { data: listRoutings, error: routingsError } = await supabase
      .from('list_routings')
      .select('list_id, description, bid, campaign_id, active')
      .eq('active', true)
      .gt('bid', 0) // Only include lists with bids > 0

    if (routingsError) {
      console.error('❌ Error fetching list routings:', routingsError)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch list routings: ${routingsError.message}`
      }, { status: 500 })
    }

    console.log(`✅ Found ${listRoutings.length} active list routings with bids`)
    
    if (!listRoutings || listRoutings.length === 0) {
      return NextResponse.json({
        success: true,
        lists: [],
        total_lists: 0,
        total_leads: 0,
        date_range: `${start_date} to ${end_date}`
      })
    }

    // STEP 2: Use unified approach for each list (same as revenue tracking)
    const results = []
    let totalLeads = 0

    for (const routing of listRoutings) {
      try {
        console.log(`🔍 Processing list ${routing.list_id} (${routing.description || 'No description'}) using unified SQL`)
        
        // Call the unified function with consistent EST timezone handling (same as revenue tracking)
        const { data: unifiedResults, error: unifiedError } = await supabase.rpc('get_lead_counts_unified', {
          p_list_id: routing.list_id,
          p_start_date: start_date,
          p_end_date: end_date,
          p_use_postback_date: false, // Normal mode: use created_at for lead counting
          p_policy_status: null, // Get all policies
          p_transfer_status: null, // Get all transfers
          p_status: null, // Use default status filtering (new/success)
          p_search: null,
          p_weekend_only: false,
          p_page: 1,
          p_page_size: 1 // We only need the count, not the data
        })
        
        if (unifiedError) {
          console.error(`❌ Unified query error for ${routing.list_id}:`, unifiedError)
          continue
        }
        
        if (!unifiedResults || unifiedResults.length === 0) {
          console.log(`📊 No data from unified query for ${routing.list_id}`)
          continue
        }
        
        const unifiedResult = unifiedResults[0]
        const listTotalLeads = parseInt(unifiedResult.total_count) || 0
        
        // Skip lists with no leads
        if (listTotalLeads === 0) {
          continue
        }
        
        totalLeads += listTotalLeads
        
        results.push({
          list_id: routing.list_id,
          partner_name: routing.description || routing.list_id,
          friendly_name: routing.description || routing.list_id,
          description: routing.description || 'No description',
          total_leads: listTotalLeads,
          first_lead_date: start_date, // Simplified for now
          last_lead_date: end_date,    // Simplified for now
          last_dnc_scrub_date: null,   // Will be populated when scrub is run
          last_dnc_rate: null,         // Will be populated when scrub is run
          scrub_status: 'ready' as const,
          dnc_matches: null,
          dnc_rate: null
        })
        
        console.log(`✅ List ${routing.list_id}: ${listTotalLeads} leads found`)
        
      } catch (listError) {
        console.error(`❌ Error processing list ${routing.list_id}:`, listError)
        continue
      }
    }
    
    const queryTime = Date.now() - startTime
    console.log(`🎯 Processed ${results.length} lists with ${totalLeads} total leads in ${queryTime}ms using unified approach`)

    // Sort results by total leads descending (same as revenue tracking)
    results.sort((a, b) => b.total_leads - a.total_leads)

    return NextResponse.json({
      success: true,
      date_range: `${start_date} to ${end_date}`,
      lists: results,
      total_lists: results.length,
      total_leads: totalLeads
    })

  } catch (error) {
    console.error('❌ [List-Activity] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get list activity using unified approach',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
