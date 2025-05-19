import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Validate API key middleware
const validateApiKey = (req: NextRequest) => {
  const apiKey = req.headers.get('x-api-key');
  
  // Accept known API keys - in production these should be stored securely
  const validApiKeys = ['test_key_123', process.env.API_KEY].filter(Boolean);
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    console.log('API key validation failed:', { provided: apiKey });
    return false;
  }
  
  return true;
};

// GET handler - Retrieve all list routings or filter by list_id
export async function GET(req: NextRequest) {
  // Validate API key
  if (!validateApiKey(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const url = new URL(req.url);
    const listId = url.searchParams.get('list_id');
    const active = url.searchParams.get('active');
    
    let query = supabase.from('list_routings').select('*');
    
    // Apply filters if provided
    if (listId) {
      query = query.eq('list_id', listId);
    }
    
    if (active) {
      query = query.eq('active', active === 'true');
    }
    
    // Order by created date
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching list routings:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
    
  } catch (error: any) {
    console.error('Unexpected error in list routings GET:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST handler - Create a new list routing
export async function POST(req: NextRequest) {
  // Validate API key
  if (!validateApiKey(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    const { list_id, campaign_id, cadence_id, token, description, active, bid } = body;
    console.log('Received POST with bid:', bid);
    
    // Validate required fields
    if (!list_id || !campaign_id || !cadence_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if an active routing already exists for this list_id
    if (active !== false) {
      const { data: existingData } = await supabase
        .from('list_routings')
        .select('id')
        .eq('list_id', list_id)
        .eq('active', true);
      
      if (existingData && existingData.length > 0) {
        // Deactivate existing routings for this list_id
        await supabase
          .from('list_routings')
          .update({ active: false })
          .eq('list_id', list_id)
          .eq('active', true);
      }
    }
    
    // Create new routing
    const { data, error } = await supabase
      .from('list_routings')
      .insert([
        {
          list_id,
          campaign_id,
          cadence_id,
          token: token || null,
          description: description || null,
          bid: typeof bid === 'number' ? bid : (bid ? parseFloat(bid) : 0.00),
          active: active === false ? false : true // Default to true
        }
      ])
      .select();
    
    if (error) {
      console.error('Error creating list routing:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data: data[0] }, { status: 201 });
    
  } catch (error: any) {
    console.error('Unexpected error in list routings POST:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT handler - Update an existing list routing
export async function PUT(req: NextRequest) {
  // Validate API key
  if (!validateApiKey(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    const { id, list_id, campaign_id, cadence_id, token, description, active, bid } = body;
    console.log('Received PUT with bid:', bid);
    
    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      );
    }
    
    // If active is being set to true, deactivate other routings for the same list_id
    if (active === true && list_id) {
      await supabase
        .from('list_routings')
        .update({ active: false })
        .eq('list_id', list_id)
        .eq('active', true)
        .neq('id', id);
    }
    
    // Update fields that are provided
    const updateFields: any = {};
    if (list_id !== undefined) updateFields.list_id = list_id;
    if (campaign_id !== undefined) updateFields.campaign_id = campaign_id;
    if (cadence_id !== undefined) updateFields.cadence_id = cadence_id;
    if (token !== undefined) updateFields.token = token;
    if (description !== undefined) updateFields.description = description;
    if (active !== undefined) updateFields.active = active;
    if (bid !== undefined) updateFields.bid = typeof bid === 'number' ? bid : (bid ? parseFloat(bid) : 0.00);
    
    const { data, error } = await supabase
      .from('list_routings')
      .update(updateFields)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error updating list routing:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    if (data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Routing not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: data[0] });
    
  } catch (error: any) {
    console.error('Unexpected error in list routings PUT:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE handler - Delete a list routing
export async function DELETE(req: NextRequest) {
  // Validate API key
  if (!validateApiKey(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('list_routings')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting list routing:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Unexpected error in list routings DELETE:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
