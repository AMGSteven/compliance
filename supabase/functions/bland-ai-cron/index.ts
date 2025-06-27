// Supabase Edge Function for Scheduled Bland AI Balance Tracking
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Response type
interface CronResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Main function to trigger the Next.js API for Bland AI balance calculation
async function triggerNextJsApi(): Promise<CronResponse> {
  console.log('Edge Function triggered. Running Bland AI balance calculation...');
  
  try {
    // Get environment variables
    const nextAppUrl = Deno.env.get('NEXT_PUBLIC_APP_URL'); // e.g., https://your-app.vercel.app
    const internalSecret = Deno.env.get('INTERNAL_TRIGGER_SECRET');

    if (!nextAppUrl || !internalSecret) {
      console.error('Missing NEXT_PUBLIC_APP_URL or INTERNAL_TRIGGER_SECRET environment variables in Edge Function settings.');
      throw new Error('Edge Function environment configuration error.');
    }

    const targetUrl = `${nextAppUrl}/api/cron/bland-ai-balance`;
    console.log(`Targeting Next.js API endpoint: ${targetUrl}`);

    // Make the POST request to the Next.js API endpoint
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Trigger-Secret': internalSecret, // Send the secret header
      },
      body: JSON.stringify({ 
        source: 'supabase-edge-cron',
        timestamp: new Date().toISOString()
      })
    });

    console.log(`Received response from Next.js API. Status: ${response.status}`);

    const responseBody = await response.json();

    if (!response.ok) {
      // Log the error details from the Next.js API if available
      console.error('Next.js API call failed:', response.status, responseBody);
      throw new Error(`Next.js API call failed with status ${response.status}: ${responseBody?.error || response.statusText}`);
    }

    console.log('Successfully triggered Next.js Bland AI balance API.');

    // Prepare response data
    return {
      success: true,
      data: {
        message: 'Bland AI balance calculation completed successfully',
        apiResponse: responseBody
      }
    };

  } catch (error) {
    console.error('Error in Bland AI balance cron job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Bland AI balance cron job'
    };
  }
}

// Set up HTTP server and handle requests
serve(async (_req: Request) => { 
  console.log('Bland AI balance cron function invoked via HTTP request:', new Date().toISOString());
  
  try {
    // Call the function that triggers the Next.js API
    const result = await triggerNextJsApi(); 
    return new Response(
      JSON.stringify(result),
      { 
        headers: { 'Content-Type': 'application/json' }, 
        status: result.success ? 200 : 500 
      }
    );
  } catch (error) {
    console.error('Critical error in Edge Function wrapper:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error in function wrapper' 
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
