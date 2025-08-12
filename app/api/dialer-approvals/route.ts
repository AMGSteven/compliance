import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - List dialer approvals (all or by list_id)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const list_id = searchParams.get('list_id')

    let query = supabase
      .from('dialer_approvals')
      .select('*')
      .order('list_id', { ascending: true })
      .order('dialer_type', { ascending: true })

    if (list_id) {
      query = query.eq('list_id', list_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching dialer approvals:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Unexpected error in GET dialer-approvals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update dialer approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { list_id, dialer_type, approved, reason, approved_by } = body

    // Validation
    if (!list_id || dialer_type === undefined || approved === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: list_id, dialer_type, approved' },
        { status: 400 }
      )
    }

  // Validate against dialer_types registry instead of fixed list
  const { data: validDialer, error: dialerErr } = await supabase
    .from('dialer_types')
    .select('id')
    .eq('id', dialer_type)
    .eq('active', true)
    .single()

  if (dialerErr || !validDialer) {
    return NextResponse.json(
      { error: 'Invalid dialer_type. Not found/active in dialer_types registry' },
      { status: 400 }
    )
  }

    // Upsert dialer approval
    const { data, error } = await supabase
      .from('dialer_approvals')
      .upsert({
        list_id,
        dialer_type,
        approved: Boolean(approved),
        reason: reason || null,
        approved_by: approved_by || 'admin',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'list_id,dialer_type'
      })
      .select()

    if (error) {
      console.error('Error upserting dialer approval:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Dialer approval updated successfully',
      data: data?.[0] 
    })
  } catch (error) {
    console.error('Unexpected error in POST dialer-approvals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove dialer approval (reset to default)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const list_id = searchParams.get('list_id')
    const dialer_type = searchParams.get('dialer_type')

    if (!list_id || !dialer_type) {
      return NextResponse.json(
        { error: 'Missing required parameters: list_id, dialer_type' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('dialer_approvals')
      .delete()
      .eq('list_id', list_id)
      .eq('dialer_type', parseInt(dialer_type))

    if (error) {
      console.error('Error deleting dialer approval:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Dialer approval removed successfully' 
    })
  } catch (error) {
    console.error('Unexpected error in DELETE dialer-approvals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
