import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const record = searchParams.get('record') === 'true';

  if (!process.env.BLAND_AI_API_KEY) {
    return NextResponse.json({ 
      success: false, 
      error: 'Bland AI API key not configured' 
    }, { status: 500 });
  }

  try {
    console.log('Fetching Bland AI account balance...');
    
    // Fetch current balance from Bland AI /v1/me endpoint
    const response = await fetch('https://api.bland.ai/v1/me', {
      headers: {
        'Authorization': process.env.BLAND_AI_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bland AI /v1/me error: ${response.status} - ${errorText}`);
      return NextResponse.json({ 
        success: false, 
        error: `Bland AI API error: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('Bland AI account data:', data);

    const result = {
      success: true,
      status: data.status,
      current_balance: data.billing?.current_balance || 0,
      refill_to: data.billing?.refill_to || null,
      total_calls: data.total_calls || 0,
      recorded_at: new Date().toISOString()
    };

    // Optionally record this data point in database
    if (record) {
      console.log('Recording balance data to database...');
      
      // Initialize Supabase client inside function to avoid build-time evaluation
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Supabase environment variables not configured');
        return NextResponse.json({ 
          ...result,
          warning: 'Failed to record balance in database: Supabase environment variables not configured'
        });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY!
      );

      try {
        const { error: insertError } = await supabase
          .from('bland_ai_balance_history')
          .insert([{
            current_balance: result.current_balance,
            refill_to: result.refill_to,
            total_calls: result.total_calls,
            status: result.status
          }]);

        if (insertError) {
          console.error('Error recording balance:', insertError);
          return NextResponse.json({ 
            ...result,
            warning: 'Failed to record balance in database'
          });
        }

        console.log('✅ Balance recorded successfully');
      } catch (error) {
        console.error('Error recording balance:', error);
        return NextResponse.json({ 
          ...result,
          warning: 'Failed to record balance in database'
        });
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching Bland AI balance:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
