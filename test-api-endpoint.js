/**
 * Test script for the phone validation API endpoint
 * This tests the integration between the RealPhoneValidation API and your compliance system
 */

// Test configuration
const API_ENDPOINT = 'http://localhost:3006/api/validation/phone';
const API_KEY = '2699AA84-6478-493F-BF14-299F89BA9719';

// Test phone numbers with different expected outcomes
const testPhones = [
  { number: '4083109269', description: 'Known good number (per client)' },
  { number: '(408) 310-9269', description: 'Formatted good number' },
  { number: '9317167522', description: 'Number from Synergy test' },
  { number: '1234567890', description: 'Invalid number' },
  { number: '0000000000', description: 'Zeroes (should fail)' },
  { number: '8005551212', description: 'Common test number' }
];

/**
 * Call the validation API
 */
async function testPhoneValidationAPI(phoneNumber) {
  console.log(`\n\n========================================`);
  console.log(`Testing phone: ${phoneNumber}`);
  console.log(`========================================`);
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        api_key: API_KEY
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Display user-friendly result
    if (data.validation_result) {
      console.log(`\n✅ RESULT: Phone number IS VALID`);
      console.log(`Phone Type: ${data.phone_type}`);
      console.log(`Carrier: ${data.carrier}`);
      console.log(`Compliance Status: ${data.compliance_status}`);
      console.log(`Risk Level: ${data.risk_level}`);
      console.log(`Raw Status: ${data.details.raw_status}`);
    } else {
      console.log(`\n❌ RESULT: Phone number is INVALID`);
      console.log(`Rejection Reason: ${data.details.reject_reason}`);
      console.log(`Compliance Status: ${data.compliance_status}`);
      console.log(`Risk Level: ${data.risk_level}`);
      console.log(`Raw Status: ${data.details.raw_status}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error testing validation API:', error);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('========================================');
  console.log('PHONE VALIDATION API INTEGRATION TEST');
  console.log('========================================');
  
  const results = [];
  
  for (const phone of testPhones) {
    const result = await testPhoneValidationAPI(phone.number);
    if (result) {
      results.push({
        phone: phone.number,
        description: phone.description,
        result
      });
    }
  }
  
  // Summary
  console.log('\n\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  results.forEach(item => {
    console.log(`${item.phone} (${item.description}): ${item.result.validation_result ? 'VALID' : 'INVALID'} - ${item.result.details.raw_status}`);
  });
  
  console.log('\nRealPhoneValidation API Integration complete!');
  console.log('Integration notes:');
  console.log('1. API accepts phone numbers in any format (it strips non-digits)');
  console.log('2. Allows: connected, connected-75, pending');
  console.log('3. Rejects: busy, disconnected, unreachable, invalid phone, etc.');
  console.log('4. Stores validation attempts in the validation_logs table if available');
  console.log('5. Endpoint: /api/validation/phone (POST)');
}

// Run the tests when the development server is running
runTests().catch(console.error);
