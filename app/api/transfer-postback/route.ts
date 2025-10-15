import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Transfer statuses
export const TRANSFER_STATUSES = {
  PENDING: 'pending',
  TRANSFERRED: 'transferred',
};

// Create service role client for database operations
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Main POST handler for transfer postbacks
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received transfer postback:', JSON.stringify(body));
    
    // Create Supabase service role client for database operations
    const supabase = createServiceClient();
    
    // Extract fields from the request
    const {
      compliance_lead_id,
      api_key,
      transfer_notes // Optional
    } = body;

    const expectedApiKey = process.env.TRANSFER_POSTBACK_API_KEY || 'test_key_123';
    if (expectedApiKey) {
      if (api_key !== expectedApiKey) {
        console.error('Invalid API key for transfer postback');
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }
    } else {
      console.warn('No API key configured for transfer postback - skipping validation');
    }

    // Validate required fields
    if (!compliance_lead_id) {
      console.error('Missing required field: compliance_lead_id');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: compliance_lead_id'
        },
        { status: 400 }
      );
    }
    
    console.log(`Processing transfer for compliance_lead_id: ${compliance_lead_id}`);

    // Find lead by compliance_lead_id
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id, transfer_status, transferred_at')
      .eq('id', compliance_lead_id) // Assuming compliance_lead_id matches leads.id (uuid)
      .limit(1);
    
    if (leadError) {
      console.error('Error finding lead:', leadError);
      return NextResponse.json(
        { success: false, error: 'Database error when finding lead' },
        { status: 500 }
      );
    }
    
    if (!leads || leads.length === 0) {
      console.error('Lead not found for transfer postback');
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    const leadId = leads[0].id;
    const transferDate = new Date().toISOString();
    
    console.log(`Processing raw transfer postback for lead ${leadId} at ${transferDate}`);
    
    // Check if this lead already has a transfer postback today (prevent duplicate counting)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();
    
    const { data: existingTransfers, error: checkError } = await supabase
      .from('transfer_postbacks')
      .select('id, created_at')
      .eq('lead_id', leadId)
      .gte('created_at', todayStartISO)
      .limit(1);
    
    if (checkError) {
      console.warn('Error checking for existing transfer today (continuing anyway):', checkError);
    } else if (existingTransfers && existingTransfers.length > 0) {
      console.log(`⚠️  Lead ${leadId} already has a transfer postback today at ${existingTransfers[0].created_at} - skipping duplicate`);
      return NextResponse.json({
        success: true,
        message: 'Transfer already recorded today',
        lead_id: leadId,
        transferred_at: existingTransfers[0].created_at,
        duplicate_prevented: true
      });
    }
    
    console.log(`✅ No existing transfer today for lead ${leadId} - processing postback`);
    
    // Update the lead record (always update to capture the latest transfer timestamp)
    const { data: updateData, error: updateError } = await supabase
      .from('leads')
      .update({
        transfer_status: true,
        transferred_at: transferDate,
        updated_at: transferDate
      })
      .eq('id', leadId)
      .select('id, transfer_status, transferred_at');
    
    if (updateError) {
      console.error('Error updating lead with transfer status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update lead with transfer status' },
        { status: 500 }
      );
    }
    
    // Log this raw transfer postback event (for accurate counting)
    // The transfer_postbacks table was created via database migration
    const { data: logData, error: logError } = await supabase
      .from('transfer_postbacks')
      .insert([{
        lead_id: leadId,
        compliance_lead_id: compliance_lead_id,
        transfer_notes: transfer_notes || null,
        payload: body,
        created_at: transferDate
      }])
      .select('id');
    
    if (logError) {
      console.warn('Error logging transfer postback event (continuing anyway):', logError);
    } else {
      console.log(`✅ Logged raw transfer postback event: ${logData?.[0]?.id}`);
    }
    
    console.log(`✅ Transfer postback processed successfully for lead ${leadId} at ${transferDate}`);
    
    return NextResponse.json({
      success: true,
      message: 'Transfer status updated successfully',
      lead_id: leadId,
      transferred_at: transferDate,
      raw_transfer_logged: !logError
    });
  } catch (error) {
    console.error('Error processing transfer postback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process transfer postback: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 