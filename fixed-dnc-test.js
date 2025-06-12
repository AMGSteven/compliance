/**
 * Targeted test for DNC API with phone_number parameter
 */
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const API_KEY = 'test_key_123';

async function testDNCAPI() {
  console.log('Testing DNC API with phone_number parameter...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        phone_number: '5551234567', // Using phone_number with underscore as shown in the code
        reason: 'Test DNC'
      })
    });
    
    console.log(`Status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    // If successful, test compliance check to verify it's in DNC
    if (response.ok && data.success) {
      console.log('\nVerifying number is in DNC via compliance check...');
      
      const complianceResponse = await fetch(`${BASE_URL}/api/v1/compliance/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ phone: '5551234567' })
      });
      
      const complianceData = await complianceResponse.json();
      console.log('Compliance check result:', JSON.stringify(complianceData, null, 2));
      
      // Check if Internal DNC flagged the number
      const dncCheck = complianceData.results?.find(r => r.source === 'Internal DNC');
      if (dncCheck && !dncCheck.compliant) {
        console.log('SUCCESS: Number correctly blocked by Internal DNC');
      } else {
        console.log('FAIL: Number was not blocked by Internal DNC');
      }
    }
  } catch (error) {
    console.error('Error testing DNC API:', error.message);
  }
}

// Run the test
testDNCAPI();
