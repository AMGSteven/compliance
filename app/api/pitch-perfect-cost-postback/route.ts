import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Supabase URL exists:', !!supabaseUrl);
  console.log('Supabase Service Role Key exists:', !!supabaseKey);
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase config - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Pitch Perfect Cost Postback API
 * Receives cost postbacks from Pitch Perfect dialer and attributes costs to leads
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received Pitch Perfect cost postback:', JSON.stringify(body));
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Extract fields from the request
    const {
      compliance_lead_id,
      billable_status,
      billable_cost,
      api_key
    } = body;

    // Validate API key
    if (process.env.POLICY_POSTBACK_API_KEY) {
      if (api_key !== process.env.POLICY_POSTBACK_API_KEY) {
        console.error('Invalid API key for Pitch Perfect cost postback');
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }
    }

    // Validate required fields
    if (!compliance_lead_id || !billable_status || billable_cost === undefined || billable_cost === null) {
      console.error('Missing required fields in Pitch Perfect cost postback');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: compliance_lead_id, billable_status, billable_cost are required'
        },
        { status: 400 }
      );
    }

    // Parse and validate cost value
    const rawCostValue = String(billable_cost);
    let parsedCost: number;
    
    try {
      // Handle both "$18.50" and "18.50" formats
      const cleanedCost = rawCostValue.replace(/[$,\s]/g, '');
      parsedCost = parseFloat(cleanedCost);
      
      if (isNaN(parsedCost) || parsedCost < 0) {
        throw new Error('Invalid cost value');
      }
    } catch (error) {
      console.error('Invalid cost format:', rawCostValue);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid cost format: ${rawCostValue}. Expected formats: "18.50" or "$18.50"`
        },
        { status: 400 }
      );
    }

    // Find lead by compliance_lead_id (which is the UUID lead_id)
    console.log(`Looking up lead with compliance_lead_id: ${compliance_lead_id}`);
    
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', compliance_lead_id)
      .limit(1);
    
    if (leadError) {
      console.error('Error finding lead:', leadError);
      return NextResponse.json(
        { success: false, error: 'Database error when finding lead' },
        { status: 500 }
      );
    }
    
    if (!leads || leads.length === 0) {
      console.error('Lead not found for Pitch Perfect cost postback');
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    const leadId = leads[0].id;
    const postbackDate = new Date();
    
    console.log(`Recording Pitch Perfect cost for lead ${leadId}: $${parsedCost} (status: ${billable_status})`);
    
    // Insert cost record
    const { data: costRecord, error: insertError } = await supabase
      .from('pitch_perfect_costs')
      .insert([{
        lead_id: leadId,
        compliance_lead_id: compliance_lead_id,
        billable_status: billable_status,
        billable_cost: parsedCost,
        raw_cost_value: rawCostValue,
        created_at: postbackDate.toISOString(),
        payload: body,
        processed_at: postbackDate.toISOString()
      }])
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Error inserting Pitch Perfect cost record:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to record cost' },
        { status: 500 }
      );
    }
    
    console.log(`✅ Successfully recorded Pitch Perfect cost: ${costRecord.id}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      cost_id: costRecord.id,
      lead_id: leadId,
      parsed_cost: parsedCost,
      billable_status: billable_status,
      message: 'Pitch Perfect cost recorded successfully'
    });
    
  } catch (error) {
    console.error('Error processing Pitch Perfect cost postback:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
