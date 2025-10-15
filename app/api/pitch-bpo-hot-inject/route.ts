/**
 * Pitch BPO Hot Inject Toggle API
 * 
 * Controls the ImportOnly parameter for Pitch BPO lead submissions per vertical.
 * - hot_inject_enabled = true → ImportOnly=0 (insert into dial queue)
 * - hot_inject_enabled = false → ImportOnly=1 (import only, no dial)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get hot inject status for all Pitch BPO verticals
    const { data, error } = await supabase
      .from('vertical_configs')
      .select('vertical, hot_inject_enabled')
      .eq('dialer_type', 2)
      .eq('active', true)
      .order('vertical');
    
    if (error) {
      console.error('[HOT INJECT] Error fetching settings:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: data || []
    });
    
  } catch (error) {
    console.error('[HOT INJECT] API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vertical, enabled } = body;
    
    if (!vertical) {
      return NextResponse.json({ 
        success: false, 
        error: 'Vertical is required' 
      }, { status: 400 });
    }
    
    const supabase = createServerClient();
    
    console.log(`[HOT INJECT] Updating ${vertical} to hot_inject_enabled=${enabled}`);
    
    // Update the hot_inject_enabled setting
    const { data, error } = await supabase
      .from('vertical_configs')
      .update({ 
        hot_inject_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('vertical', vertical)
      .eq('dialer_type', 2)
      .select();
    
    if (error) {
      console.error('[HOT INJECT] Error updating setting:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    console.log(`[HOT INJECT] ✅ Updated ${vertical}: ImportOnly will be '${enabled ? '0' : '1'}'`);
    
    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: `Hot inject ${enabled ? 'enabled' : 'disabled'} for ${vertical}`
    });
    
  } catch (error) {
    console.error('[HOT INJECT] API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

