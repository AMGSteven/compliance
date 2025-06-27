import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📢 DNC Webhook notification received:', {
      event: body.event,
      timestamp: body.timestamp,
      phoneNumber: body.data?.phoneNumber,
      source: body.data?.source
    });

    // Here you can add your webhook processing logic
    // For example: forward to external systems, log to database, etc.
    
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received successfully',
      received_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing DNC webhook:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'DNC Notifications Webhook Endpoint',
    methods: ['POST'],
    status: 'active'
  });
}
