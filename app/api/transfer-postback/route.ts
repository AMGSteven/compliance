import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Transfer statuses
export const TRANSFER_STATUSES = {
  PENDING: 'pending',
  TRANSFERRED: 'transferred',
};

// Main POST handler for transfer postbacks
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received transfer postback:', JSON.stringify(body));
    
    // Create Supabase client
    const supabase = createServerClient();
    
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
      .select('id, transfer_status')
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
    const currentTransferStatus = leads[0].transfer_status;
    
    if (currentTransferStatus === true) {
      console.log(`Lead ${leadId} already transferred, skipping update`);
      return NextResponse.json({
        success: true,
        message: 'Lead already marked as transferred',
        lead_id: leadId
      });
    }
    
    const transferDate = new Date().toISOString();
    
    console.log(`Updating lead ${leadId} to transferred at ${transferDate}`);
    
    // Update the lead record
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
    
    // Optionally log the event (create a transfers table if needed, but for now, just update leads)
    
    console.log(`✅ Transfer postback processed successfully for lead ${leadId} at ${transferDate}`);
    
    return NextResponse.json({
      success: true,
      message: 'Transfer status updated successfully',
      lead_id: leadId,
      transferred_at: transferDate
    });
  } catch (error) {
    console.error('Error processing transfer postback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process transfer postback: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 