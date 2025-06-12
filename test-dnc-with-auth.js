// Test script for DNC submission with authentication
import fetch from 'node-fetch';

async function testDNCWithAuth() {
  const baseUrl = 'https://compliance.juicedmedia.io';
  const testNumber = '1234567890';
  
  try {
    // Step 1: Login to get cookie/session
    console.log('Logging in...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: '123456'
      }),
      redirect: 'manual'
    });
    
    console.log('Login response status:', loginRes.status);
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log('Set-Cookie header present:', !!setCookieHeader);
    
    if (loginRes.status >= 300 && loginRes.status < 400) {
      console.log('Redirect location:', loginRes.headers.get('location'));
    }
    
    // Step 2: Try to submit DNC with cookie and API key
    console.log('\nSubmitting DNC entry...');
    const dncRes = await fetch(`${baseUrl}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123',
        'Cookie': setCookieHeader || ''
      },
      body: JSON.stringify({
        api_key: 'test_key_123',
        phone_number: testNumber,
        reason: 'Customer requested opt-out',
        source: 'dialer_system'
      }),
      redirect: 'manual'
    });
    
    console.log('DNC submission status:', dncRes.status);
    
    if (dncRes.status >= 300 && dncRes.status < 400) {
      console.log('Redirect location:', dncRes.headers.get('location'));
    } else {
      let responseText;
      try {
        responseText = await dncRes.text();
        // Try to parse as JSON if possible
        try {
          const jsonResponse = JSON.parse(responseText);
          console.log('DNC submission response:', JSON.stringify(jsonResponse, null, 2));
        } catch (e) {
          // Not JSON, just log the text
          console.log('Response text (first 500 chars):', responseText.substring(0, 500));
        }
      } catch (e) {
        console.log('Error reading response:', e);
      }
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testDNCWithAuth();
