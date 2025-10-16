import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateDialerApprovals, getDialerTypeName } from '@/lib/utils/dialer-approval'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const listId = searchParams.get('list_id')

    let query = supabase
      .from('routing_weights')
      .select('*')
      .eq('active', true)
      .order('dialer_type', { ascending: true })

    if (listId) {
      query = query.eq('list_id', listId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching routing weights:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ weights: data })
  } catch (error: any) {
    console.error('Error in weighted routing API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { list_id, weights } = body

    if (!list_id || !weights || !Array.isArray(weights)) {
      return NextResponse.json({ 
        error: 'List ID and weights array are required' 
      }, { status: 400 })
    }

    // Validate that weights sum to 100%
    const totalWeight = weights.reduce((sum, w) => sum + (w.weight_percentage || 0), 0)
    if (totalWeight !== 100) {
      return NextResponse.json({ 
        error: `Weights must sum to 100%. Current total: ${totalWeight}%` 
      }, { status: 400 })
    }

    // Validate each weight
    for (const weight of weights) {
      if (!weight.dialer_type || weight.weight_percentage < 0 || weight.weight_percentage > 100) {
        return NextResponse.json({ 
          error: 'Each weight must have valid dialer_type and weight_percentage (0-100)' 
        }, { status: 400 })
      }
    }

    // *** DIALER APPROVAL ENFORCEMENT FOR WEIGHTED ROUTING ***
    // Check if all dialers in the weighted routing are approved for this list ID
    const dialerTypes = weights.map(w => parseInt(w.dialer_type))
    // Validate dialers exist in registry
    const { data: validDialers, error: dtErr } = await supabase
      .from('dialer_types')
      .select('id')
      .in('id', dialerTypes)
      .eq('active', true)
    if (dtErr || (validDialers || []).length !== dialerTypes.length) {
      return NextResponse.json({ error: 'One or more dialer types are invalid or inactive' }, { status: 400 })
    }
    const approvalValidation = await validateDialerApprovals(list_id, dialerTypes)
    
    if (!approvalValidation.isValid) {
      const deniedDialerNames = approvalValidation.deniedDialers.map(dt => getDialerTypeName(dt))
      console.error(`❌ COMPLIANCE BLOCK: Cannot set weighted routing - denied dialers: ${deniedDialerNames.join(', ')} for list_id: ${list_id}`)
      return NextResponse.json({
        success: false,
        error: 'COMPLIANCE_VIOLATION',
        message: `The following dialers are not approved for this list ID: ${deniedDialerNames.join(', ')}. Contact compliance team.`,
        details: {
          list_id: list_id,
          denied_dialers: approvalValidation.deniedDialers,
          denied_dialer_names: deniedDialerNames,
          reason: 'One or more dialers in weighted routing configuration are denied by compliance team'
        }
      }, { status: 403 }) // 403 Forbidden
    }
    
    console.log(`✅ All dialers approved for weighted routing on list_id: ${list_id} - allowing configuration`)

    // More robust approach: Delete existing weights and insert new ones
    // First, delete all existing weights for this list_id to avoid constraint violations
    const { error: deleteError } = await supabase
      .from('routing_weights')
      .delete()
      .eq('list_id', list_id)

    if (deleteError) {
      console.error('Error deleting existing weights:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Insert new weights
    const newWeights = weights.map(w => ({
      list_id,
      dialer_type: parseInt(w.dialer_type),
      weight_percentage: parseInt(w.weight_percentage),
      active: true
    }))

    const { data, error: insertError } = await supabase
      .from('routing_weights')
      .insert(newWeights)
      .select()

    if (insertError) {
      console.error('Error inserting new weights:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Enable weighted routing for this list ID
    const { error: updateListError } = await supabase
      .from('list_routings')
      .update({ weighted_routing_enabled: true })
      .eq('list_id', list_id)

    if (updateListError) {
      console.error('Error enabling weighted routing:', updateListError)
      // Don't fail the request, just log the warning
      console.warn('Warning: Could not enable weighted_routing_enabled flag')
    }

    return NextResponse.json({ 
      success: true, 
      weights: data,
      message: `Weighted routing configured: ${weights.map(w => `${w.weight_percentage}% ${getDialerLabel(w.dialer_type)}`).join(', ')}`
    })
  } catch (error: any) {
    console.error('Error in weighted routing API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const listId = searchParams.get('list_id')

    if (!listId) {
      return NextResponse.json({ error: 'List ID is required' }, { status: 400 })
    }

    // Delete all weights for this list ID
    const { error } = await supabase
      .from('routing_weights')
      .delete()
      .eq('list_id', listId)

    if (error) {
      console.error('Error deactivating weights:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Disable weighted routing for this list ID
    const { error: updateListError } = await supabase
      .from('list_routings')
      .update({ weighted_routing_enabled: false })
      .eq('list_id', listId)

    if (updateListError) {
      console.error('Error disabling weighted routing:', updateListError)
      // Don't fail the request, just log the warning
      console.warn('Warning: Could not disable weighted_routing_enabled flag')
    }

    return NextResponse.json({ 
      success: true, 
      message: `Weighted routing disabled for ${listId}` 
    })
  } catch (error: any) {
    console.error('Error in weighted routing API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getDialerLabel(dialerType: number): string {
  switch (dialerType) {
    case 1: return 'Internal Dialer'
    case 2: return 'Pitch BPO'
    case 3: return 'Convoso'
    default: return 'Unknown'
  }
}
