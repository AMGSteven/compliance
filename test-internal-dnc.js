// Test script for Internal DNC API
const testNumber = '1234567890';
const apiUrl = 'https://compliance.juicedmedia.io/api/dialer/dnc';

async function testInternalDNCApi() {
  console.log(`Testing Internal DNC API to add number: ${testNumber}`);
  
  try {
    const response = await fetch(apiUrl, {
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
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Response text:', text);
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Internal DNC API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Interpret the result
    if (data.success === true) {
      console.log('✅ RESULT: Number successfully added to DNC list');
    } else {
      console.log('❌ RESULT: Failed to add number to DNC list');
    }
  } catch (error) {
    console.error('Error testing Internal DNC API:', error);
  }
}

// Run the test
testInternalDNCApi();
