import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  try {
    // Get all unique list_ids with lead counts and date ranges
    const { data, error } = await supabase
      .from('leads')
      .select('list_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching list IDs:', error)
      return NextResponse.json({ error: 'Failed to fetch list IDs' }, { status: 500 })
    }

    // Group by list_id and get stats
    const listStats = data.reduce((acc: any, lead: any) => {
      const listId = lead.list_id
      if (!acc[listId]) {
        acc[listId] = {
          list_id: listId,
          count: 0,
          earliest_date: lead.created_at,
          latest_date: lead.created_at
        }
      }
      acc[listId].count++
      if (lead.created_at < acc[listId].earliest_date) {
        acc[listId].earliest_date = lead.created_at
      }
      if (lead.created_at > acc[listId].latest_date) {
        acc[listId].latest_date = lead.created_at
      }
      return acc
    }, {})

    const result = Object.values(listStats)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 20) // Top 20 list IDs by lead count

    return NextResponse.json({
      success: true,
      total_unique_lists: Object.keys(listStats).length,
      top_lists: result
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
