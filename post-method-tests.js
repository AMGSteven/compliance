/**
 * Test compliance endpoints using POST method
 */
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const API_KEY = 'test_key_123';
const VALID_PHONE = '6507769592';

async function testComplianceWithPost() {
  console.log('Testing compliance endpoints with POST method...');
  
  const endpoints = [
    { url: `${BASE_URL}/api/check-compliance`, name: 'Standard compliance endpoint' },
    { url: `${BASE_URL}/api/v1/compliance/check`, name: 'V1 compliance endpoint' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint.name} with POST:`);
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ phone: VALID_PHONE })
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
      } else {
        try {
          const errorText = await response.text();
          console.log('Error response:', errorText.slice(0, 200) + '...');
        } catch (e) {
          console.log('Could not read response');
        }
      }
    } catch (error) {
      console.error(`Error testing ${endpoint.name}:`, error.message);
    }
  }
}

// Test the DNC API with different formats
async function testDNCAPI() {
  console.log('\nTesting DNC API with proper phoneNumber format...');
  
  try {
    // Try with formatted phone number and debug headers
    const response = await fetch(`${BASE_URL}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Debug': 'true'
      },
      body: JSON.stringify({
        phoneNumber: '555-123-4567', // Try formatted version
        reason: 'Test DNC'
      })
    });
    
    console.log(`Status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing DNC API:', error.message);
  }
}

// Run both tests
async function runTests() {
  await testComplianceWithPost();
  await testDNCAPI();
}

runTests();
