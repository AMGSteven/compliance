// Test script for DNC submission with only API key
import fetch from 'node-fetch';

async function testDNCWithApiKeyOnly() {
  const baseUrl = 'http://localhost:3000';
  const testNumber = '1234567890';
  
  try {
    // Try to submit DNC with just the API key
    console.log('Submitting DNC entry with API key only...');
    const dncRes = await fetch(`${baseUrl}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify({
        api_key: 'test_key_123',
        phone_number: testNumber,
        reason: 'Customer requested opt-out',
        source: 'dialer_system'
      })
    });
    
    console.log('DNC submission status:', dncRes.status);
    
    try {
      const responseText = await dncRes.text();
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
    
    // Now test GET request to check if a number is in DNC
    console.log('\nChecking if number is in DNC with API key only...');
    const checkRes = await fetch(`${baseUrl}/api/dialer/dnc?phone=${testNumber}&api_key=test_key_123`, {
      method: 'GET',
      headers: {
        'X-API-Key': 'test_key_123'
      }
    });
    
    console.log('DNC check status:', checkRes.status);
    
    try {
      const responseText = await checkRes.text();
      // Try to parse as JSON if possible
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('DNC check response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        // Not JSON, just log the text
        console.log('Response text (first 500 chars):', responseText.substring(0, 500));
      }
    } catch (e) {
      console.log('Error reading response:', e);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testDNCWithApiKeyOnly();
