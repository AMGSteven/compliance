import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ComplianceEngine } from '@/lib/compliance/engine';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    // Log start of request
    console.log('DEBUG: Lead post debug API called at', new Date().toISOString());
    
    // Parse the request body
    const body = await request.json();
    console.log('DEBUG: Received lead body keys:', Object.keys(body));
    
    // Extract key fields
    const phone = body.phone || body.Phone || body.PhoneNumber || '';
    console.log('DEBUG: Processing phone number:', phone);
    
    // STEP 1: Try to connect to database
    console.log('DEBUG: STEP 1 - Testing database connection');
    const dbStartTime = Date.now();
    let dbSuccess = false;
    
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase.from('leads').select('count').limit(1);
      
      if (error) {
        console.error('DEBUG: Database connection error:', error);
      } else {
        dbSuccess = true;
        console.log('DEBUG: Database connection successful');
      }
    } catch (dbError) {
      console.error('DEBUG: Database test error:', dbError);
    }
    
    console.log(`DEBUG: Database test completed in ${Date.now() - dbStartTime}ms, success: ${dbSuccess}`);
    
    // STEP 2: Test compliance engine
    console.log('DEBUG: STEP 2 - Testing compliance engine');
    const complianceStartTime = Date.now();
    let complianceSuccess = false;
    let complianceResult = null;
    
    try {
      const engine = new ComplianceEngine();
      complianceResult = await engine.checkPhoneNumber(phone);
      complianceSuccess = true;
      console.log('DEBUG: Compliance check successful:', complianceResult.isCompliant);
    } catch (complianceError) {
      console.error('DEBUG: Compliance engine error:', complianceError);
    }
    
    console.log(`DEBUG: Compliance test completed in ${Date.now() - complianceStartTime}ms, success: ${complianceSuccess}`);
    
    // STEP 3: Mock dialer API call
    console.log('DEBUG: STEP 3 - Testing dialer API call');
    const dialerStartTime = Date.now();
    let dialerSuccess = false;
    
    try {
      // We'll just mock this without actually calling external API
      // Wait for 2 seconds to simulate network latency
      await new Promise(resolve => setTimeout(resolve, 2000));
      dialerSuccess = true;
      console.log('DEBUG: Dialer API test successful (mock)');
    } catch (dialerError) {
      console.error('DEBUG: Dialer API test error:', dialerError);
    }
    
    console.log(`DEBUG: Dialer API test completed in ${Date.now() - dialerStartTime}ms, success: ${dialerSuccess}`);
    
    // Return diagnostic information
    return NextResponse.json({
      success: true,
      diagnostic: {
        totalTimeMs: Date.now() - startTime,
        database: {
          success: dbSuccess,
          timeMs: Date.now() - dbStartTime
        },
        compliance: {
          success: complianceSuccess,
          timeMs: Date.now() - complianceStartTime,
          result: complianceResult ? {
            isCompliant: complianceResult.isCompliant,
            results: complianceResult.results.map(r => ({
              source: r.source,
              isCompliant: r.isCompliant,
              reasons: r.reasons
            }))
          } : null
        },
        dialer: {
          success: dialerSuccess,
          timeMs: Date.now() - dialerStartTime
        }
      }
    });
  } catch (error) {
    console.error('DEBUG: Overall error in debug API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTimeMs: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
