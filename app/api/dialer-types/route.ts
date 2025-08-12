import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  const { data, error } = await supabase
    .from('dialer_types')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dialers: data })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, name, slug, default_color, active } = body
  if (!id || !name) return NextResponse.json({ error: 'id and name are required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dialer_types')
    .upsert({ id: parseInt(id), name, slug, default_color, active: active ?? true }, { onConflict: 'id' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, dialer: data?.[0] })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, name, slug, default_color, active } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dialer_types')
    .update({ name, slug, default_color, active })
    .eq('id', parseInt(id))
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, dialer: data?.[0] })
}

