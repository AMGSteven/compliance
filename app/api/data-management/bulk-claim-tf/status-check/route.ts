import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { certificateIds } = await req.json();
    
    if (!certificateIds || !Array.isArray(certificateIds)) {
      console.log('[TrustedForm Status Check] Invalid request - missing or invalid certificateIds array');
      return NextResponse.json({ error: 'Invalid certificateIds array' }, { status: 400 });
    }

    console.log(`[TrustedForm Status Check] Processing ${certificateIds.length} certificate IDs...`);
    
    const results = [];
    
    // Process each certificate ID
    for (let i = 0; i < certificateIds.length; i++) {
      const certId = certificateIds[i];
      console.log(`[TrustedForm Status Check] Checking ${i + 1}/${certificateIds.length}: ${certId}`);
      
      try {
        // Call TrustedForm GET API with proper authentication (same as existing service)
        const API_KEY = process.env.TRUSTED_FORM_API_KEY;
        if (!API_KEY) {
          console.error(`[TrustedForm Status Check] ${certId} - Missing TRUSTED_FORM_API_KEY`);
          results.push({ 
            certId, 
            status: 'Failed', 
            error: 'Missing TrustedForm API key configuration',
            timestamp: new Date().toISOString()
          });
          continue;
        }

        const response = await fetch(`https://cert.trustedform.com/certificates/${certId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'TrustedForm-Status-Checker/1.0',
          },
        });

        console.log(`[TrustedForm Status Check] ${certId} - Response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`[TrustedForm Status Check] ${certId} - Success:`, JSON.stringify(data).substring(0, 200));
          results.push({ 
            certId, 
            status: 'Success', 
            data,
            timestamp: new Date().toISOString()
          });
        } else if (response.status === 404) {
          console.log(`[TrustedForm Status Check] ${certId} - Not found (404)`);
          results.push({ 
            certId, 
            status: 'Failed', 
            error: 'Certificate expired or not found',
            timestamp: new Date().toISOString()
          });
        } else if (response.status === 400) {
          console.log(`[TrustedForm Status Check] ${certId} - Bad request (400)`);
          results.push({ 
            certId, 
            status: 'Failed', 
            error: 'Malformed certificate ID',
            timestamp: new Date().toISOString()
          });
        } else {
          const errorText = `HTTP ${response.status}: ${response.statusText}`;
          console.log(`[TrustedForm Status Check] ${certId} - Error: ${errorText}`);
          results.push({ 
            certId, 
            status: 'Failed', 
            error: errorText,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        const errorMessage = `Network error: ${error}`;
        console.error(`[TrustedForm Status Check] ${certId} - Exception:`, error);
        results.push({ 
          certId, 
          status: 'Failed', 
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log(`[TrustedForm Status Check] Completed processing ${results.length} certificates`);
    const successCount = results.filter(r => r.status === 'Success').length;
    const failedCount = results.filter(r => r.status === 'Failed').length;
    console.log(`[TrustedForm Status Check] Results: ${successCount} successful, ${failedCount} failed`);
    
    return NextResponse.json({ 
      success: true, 
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failedCount
      }
    });
    
  } catch (error) {
    console.error('[TrustedForm Status Check] API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
