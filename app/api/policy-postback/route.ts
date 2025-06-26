import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Policy statuses
export const POLICY_STATUSES = {
  PENDING: 'pending',
  ISSUED: 'issued',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

// Main POST handler for policy postbacks - simplified version for just policy_status updates
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    console.log('Received policy postback:', JSON.stringify(body));
    
    // Create Supabase client
    const supabase = createServerClient();
    
    // Extract fields from the request
    const {
      lead_id,
      compliance_lead_id,
      transaction_id,
      email,
      phone,
      policy_status,
      policy_id,
      policy_carrier,
      policy_type,
      policy_premium,
      policy_commission,
      policy_effective_date,
      policy_notes,
      api_key
    } = body;

    // Validate API key if configured
    if (process.env.POLICY_POSTBACK_API_KEY) {
      if (api_key !== process.env.POLICY_POSTBACK_API_KEY) {
        console.error('Invalid API key for policy postback');
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }
    }

    // Validate required fields
    if (!policy_status) {
      console.error('Missing required field: policy_status');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: policy_status'
        },
        { status: 400 }
      );
    }

    // Normalize policy status
    const normalizedStatus = policy_status.toLowerCase();
    const validStatus = Object.values(POLICY_STATUSES).includes(normalizedStatus) 
      ? normalizedStatus 
      : POLICY_STATUSES.PENDING;
    
    // Use compliance_lead_id if lead_id is not provided (for backward compatibility)
    const effectiveLeadId = lead_id || compliance_lead_id;

    console.log(`Lead identification: lead_id=${lead_id}, compliance_lead_id=${compliance_lead_id}, effectiveLeadId=${effectiveLeadId}`);

    // Find lead by lead_id/compliance_lead_id, transaction_id, email, or phone (in that order of preference)
    let leadQuery = supabase.from('leads').select('id');
    
    if (effectiveLeadId) {
      leadQuery = leadQuery.eq('id', effectiveLeadId);
    } else if (transaction_id) {
      leadQuery = leadQuery.eq('transaction_id', transaction_id);
    } else if (email) {
      leadQuery = leadQuery.eq('email', email);
    } else if (phone) {
      // Normalize phone number (remove non-digits)
      const normalizedPhone = phone.replace(/\D/g, '');
      leadQuery = leadQuery.eq('phone', normalizedPhone);
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to identify lead. Please provide lead_id, compliance_lead_id, transaction_id, email, or phone.' 
        },
        { status: 400 }
      );
    }

    // Get the lead record
    const { data: leads, error: leadError } = await leadQuery.limit(1);
    
    if (leadError) {
      console.error('Error finding lead:', leadError);
      return NextResponse.json(
        { success: false, error: 'Database error when finding lead' },
        { status: 500 }
      );
    }
    
    if (!leads || leads.length === 0) {
      console.error('Lead not found for policy postback');
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }
    
    const leadId = leads[0].id;
    const postbackDate = new Date().toISOString();
    
    console.log(`Found lead with ID ${leadId} for policy status update: ${validStatus}`);
    
    // Update the lead record with the policy status and postback date
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        policy_status: validStatus,
        updated_at: postbackDate,
        policy_postback_date: postbackDate  // Track when postback was received for revenue attribution
      })
      .eq('id', leadId);
    
    if (updateError) {
      console.error('Error updating lead with policy status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update lead with policy status' },
        { status: 500 }
      );
    }
    
    // Record the postback event in policy_postbacks table for audit trail
    const { error: postbackError } = await supabase
      .from('policy_postbacks')
      .insert([{
        lead_id: leadId,
        compliance_lead_id: compliance_lead_id || null,
        policy_status: validStatus,
        payload: body,
        created_at: postbackDate
      }]);
    
    if (postbackError) {
      console.error('Error recording postback event:', postbackError);
      // Don't fail the request if audit logging fails, but log the error
    }
    
    console.log(`✅ Policy postback processed successfully: ${validStatus} for lead ${leadId} at ${postbackDate}`);
    
    return NextResponse.json({
      success: true,
      message: 'Policy status updated successfully',
      policy_status: validStatus,
      lead_id: leadId,
      postback_date: postbackDate
    });
  } catch (error) {
    console.error('Error processing policy postback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process policy postback: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
