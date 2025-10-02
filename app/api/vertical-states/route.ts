import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// All US states
const ALL_US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vertical = searchParams.get('vertical')

    let query = supabase
      .from('vertical_state_configs')
      .select('*')
      .order('vertical', { ascending: true })
      .order('state_code', { ascending: true })

    if (vertical) {
      query = query.eq('vertical', vertical)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching vertical state configs:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // If requesting a specific vertical, return all states with their status
    if (vertical) {
      const stateMap = new Map(data?.map(s => [s.state_code, s]) || [])
      const allStatesForVertical = ALL_US_STATES.map(state => {
        const existing = stateMap.get(state)
        return existing || {
          vertical,
          state_code: state,
          is_allowed: false,
          notes: null,
          created_at: null,
          updated_at: null
        }
      })
      return NextResponse.json({ success: true, data: allStatesForVertical })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error('Error in vertical states API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vertical, state_code, is_allowed, notes } = body

    if (!vertical || !state_code) {
      return NextResponse.json({ error: 'Vertical and state_code are required' }, { status: 400 })
    }

    // Validate state code
    if (!ALL_US_STATES.includes(state_code.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid state code' }, { status: 400 })
    }

    // Validate vertical
    const validVerticals = ['ACA', 'Final Expense', 'Medicare']
    if (!validVerticals.includes(vertical)) {
      return NextResponse.json({ error: 'Invalid vertical. Must be ACA, Final Expense, or Medicare' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vertical_state_configs')
      .upsert({
        vertical,
        state_code: state_code.toUpperCase(),
        is_allowed: is_allowed !== undefined ? is_allowed : true,
        notes: notes || null
      }, {
        onConflict: 'vertical,state_code'
      })
      .select()

    if (error) {
      console.error('Error updating vertical state config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, config: data?.[0] })
  } catch (error: any) {
    console.error('Error in vertical states API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { vertical, states } = body

    if (!vertical || !states || !Array.isArray(states)) {
      return NextResponse.json({ error: 'Vertical and states array are required' }, { status: 400 })
    }

    // Validate vertical
    const validVerticals = ['ACA', 'Final Expense', 'Medicare']
    if (!validVerticals.includes(vertical)) {
      return NextResponse.json({ error: 'Invalid vertical' }, { status: 400 })
    }

    // Bulk update states for a vertical
    const updates = states.map(state => ({
      vertical,
      state_code: state.state_code.toUpperCase(),
      is_allowed: state.is_allowed,
      notes: state.notes || null
    }))

    const { data, error } = await supabase
      .from('vertical_state_configs')
      .upsert(updates, {
        onConflict: 'vertical,state_code'
      })
      .select()

    if (error) {
      console.error('Error bulk updating vertical state configs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: data?.length || 0 })
  } catch (error: any) {
    console.error('Error in vertical states bulk update API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vertical = searchParams.get('vertical')
    const state_code = searchParams.get('state_code')

    if (!vertical || !state_code) {
      return NextResponse.json({ error: 'Vertical and state_code are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('vertical_state_configs')
      .delete()
      .eq('vertical', vertical)
      .eq('state_code', state_code.toUpperCase())

    if (error) {
      console.error('Error deleting vertical state config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in vertical states delete API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
