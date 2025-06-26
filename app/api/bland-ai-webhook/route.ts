import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client inside function to avoid build-time evaluation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const callData = await request.json();
    
    console.log('Received Bland AI webhook:', callData);
    
    // Extract cost information from the webhook payload
    const { 
      call_id, 
      created_at, 
      price,
      cost,
      // Add other relevant fields from webhook
    } = callData;
    
    // Store call cost data in database for efficient querying
    const { error } = await supabase
      .from('bland_ai_call_costs')
      .insert([
        {
          call_id,
          created_at,
          cost: price || cost || 0,
          webhook_data: callData, // Store full payload for reference
          processed_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error('Error storing call cost:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Call cost recorded' });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
  }
}

// Verify webhook signature for security (optional but recommended)
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  // Implement webhook signature verification if Bland AI provides it
  // This prevents unauthorized webhook calls
  return true; // Placeholder
}
