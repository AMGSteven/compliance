import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vertical = searchParams.get('vertical')

    let query = supabase
      .from('vertical_configs')
      .select('*')
      .eq('active', true)
      .order('vertical', { ascending: true })
      .order('dialer_type', { ascending: true })

    if (vertical) {
      query = query.eq('vertical', vertical)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching vertical configs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ configs: data })
  } catch (error: any) {
    console.error('Error in vertical configs API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vertical, dialer_type, campaign_id, cadence_id, token } = body

    if (!vertical || !dialer_type) {
      return NextResponse.json({ error: 'Vertical and dialer_type are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vertical_configs')
      .upsert({
        vertical,
        dialer_type: parseInt(dialer_type),
        campaign_id,
        cadence_id,
        token: dialer_type === 2 ? token : null, // Only store token for Pitch BPO
        active: true
      }, {
        onConflict: 'vertical,dialer_type'
      })
      .select()

    if (error) {
      console.error('Error updating vertical config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, config: data?.[0] })
  } catch (error: any) {
    console.error('Error in vertical configs API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { list_id, vertical } = body
    
    console.log('🔍 Vertical PUT API Debug:', {
      list_id,
      vertical,
      body,
      timestamp: new Date().toISOString()
    })

    if (!list_id || !vertical) {
      console.error('❌ Missing required fields:', { list_id, vertical })
      return NextResponse.json({ error: 'List ID and vertical are required' }, { status: 400 })
    }

    // Validate vertical value
    const validVerticals = ['ACA', 'Final Expense', 'Medicare']
    if (!validVerticals.includes(vertical)) {
      return NextResponse.json({ error: 'Invalid vertical. Must be ACA, Final Expense, or Medicare' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('list_routings')
      .update({ vertical })
      .eq('list_id', list_id)
      .select()

    if (error) {
      console.error('Error updating list routing vertical:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'List ID not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, updated: data[0] })
  } catch (error: any) {
    console.error('Error in vertical configs API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
