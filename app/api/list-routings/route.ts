import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
    const { list_id, campaign_id, cadence_id, description, active, bid, token, dialer_type } = body;
    console.log('Received POST with bid:', bid);
    
    // Validate required fields based on dialer type
    // For Pitch BPO (dialer_type=2), all three fields (list_id, campaign_id, cadence_id) are optional
    // since we'll generate placeholders on the backend
    const isPitchBPO = dialer_type === 2;
    
    // For the internal dialer (type 1), all fields are required
    // For Pitch BPO (type 2), no fields are required as we'll use placeholders
    if (!isPitchBPO && (!list_id || !campaign_id || !cadence_id)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          details: {
            missingFields: (() => {
              const fields: string[] = [];
              if (!isPitchBPO) {
                if (!list_id) fields.push('list_id');
                if (!campaign_id) fields.push('campaign_id');
                if (!cadence_id) fields.push('cadence_id');
              }
              return fields;
            })()
          }
        },
        { status: 400 }
      );
    }
    
    // Check if an active routing already exists for this list_id (skip for empty list_id)
    if (active !== false && list_id) {
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
    
    // Define Pitch BPO token constant
    const PITCH_BPO_TOKEN = '70942646-125b-4ddd-96fc-b9a142c698b8';
    
    // Prepare the insert payload with common fields
    const insertPayload: any = {
      description: description || null,
      active: active !== false,
      bid: bid || 0.00,
      dialer_type: dialer_type || 1, // Default to internal dialer (1) if not specified
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Handle special case for Pitch BPO (dialer_type 2)
    if (dialer_type === 2) {
      // For Pitch BPO, ALWAYS use the hardcoded token
      insertPayload.token = PITCH_BPO_TOKEN;
      console.log('Using hardcoded Pitch BPO token:', PITCH_BPO_TOKEN);
      
      // For Pitch BPO, use placeholders for required fields if empty
      const timestamp = Date.now().toString();
      
      // Based on schema constraints, these fields are required
      insertPayload.list_id = list_id || `pitch-bpo-list-${timestamp}`;
      insertPayload.campaign_id = campaign_id || `pitch-bpo-campaign-${timestamp}`;
      insertPayload.cadence_id = cadence_id || `pitch-bpo-cadence-${timestamp}`;
      
      console.log('Using placeholders for Pitch BPO:', {
        list_id: insertPayload.list_id,
        campaign_id: insertPayload.campaign_id,
        cadence_id: insertPayload.cadence_id
      });
    } else {
      // For regular internal dialer, use the actual values
      insertPayload.token = token || null;
      insertPayload.list_id = list_id;
      insertPayload.campaign_id = campaign_id;
      insertPayload.cadence_id = cadence_id;
    }
    
    console.log('Final insert payload:', insertPayload);
    
    // Variable to store the inserted data
    let insertedData: any = null;
    
    try {
      console.log('About to insert with payload:', JSON.stringify(insertPayload, null, 2));
      
      // Check if all required fields are present before inserting
      if (!insertPayload.list_id) {
        console.error('Missing list_id in payload');
        return NextResponse.json({
          success: false,
          error: 'Missing list_id in payload',
          details: insertPayload
        }, { status: 400 });
      }
      
      if (!insertPayload.campaign_id) {
        console.error('Missing campaign_id in payload');
        return NextResponse.json({
          success: false,
          error: 'Missing campaign_id in payload',
          details: insertPayload
        }, { status: 400 });
      }
      
      if (!insertPayload.cadence_id) {
        console.error('Missing cadence_id in payload');
        return NextResponse.json({
          success: false,
          error: 'Missing cadence_id in payload',
          details: insertPayload
        }, { status: 400 });
      }
      
      // Insert the new list routing
      const { data, error } = await supabase
        .from('list_routings')
        .insert([insertPayload])
        .select();
      
      if (error) {
        console.error('Error creating list routing:', error);
        return NextResponse.json({
          success: false,
          error: error.message,
          details: {
            code: error.code,
            hint: error.hint,
            details: error.details,
            payload: insertPayload
          }
        }, { status: 500 });
      }
      
      console.log('Successfully created list routing:', data);
      insertedData = data;
    } catch (err: any) {
      console.error('Unexpected error in list routing insert:', err);
      return NextResponse.json({
        success: false,
        error: err.message || 'Unknown error during insert',
        details: { payload: insertPayload }
      }, { status: 500 });
    }
    
    // Only return success if we have data
    if (!insertedData || !insertedData[0]) {
      return NextResponse.json({ 
        success: false, 
        error: 'No data returned after insertion' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data: insertedData[0] }, { status: 201 });
    
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
