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
      transaction_id,
      email,
      phone,
      policy_status,
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
    
    // Find lead by lead_id, transaction_id, email, or phone (in that order of preference)
    let leadQuery = supabase.from('leads').select('id');
    
    if (lead_id) {
      leadQuery = leadQuery.eq('id', lead_id);
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
          error: 'Unable to identify lead. Please provide lead_id, transaction_id, email, or phone.' 
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
    console.log(`Found lead with ID ${leadId} for policy status update: ${validStatus}`);
    
    // Update the lead record with the policy status
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        policy_status: validStatus
      })
      .eq('id', leadId);
    
    if (updateError) {
      console.error('Error updating lead with policy status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update lead with policy status' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Policy status updated successfully',
      policy_status: validStatus,
      lead_id: leadId
    });
  } catch (error) {
    console.error('Error processing policy postback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process policy postback: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
