// Test to verify disconnected and bad status numbers are blocked
const fetch = require('node-fetch');

// List of phone numbers with different statuses to test
const PHONE_STATUSES = [
  { phone: '5551234567', expectedStatus: 'disconnected', description: 'Disconnected number' },
  { phone: '5552345678', expectedStatus: 'disconnected-70', description: 'Disconnected-70 number' },
  { phone: '5553456789', expectedStatus: 'unreachable', description: 'Unreachable number' },
  { phone: '5554567890', expectedStatus: 'invalid phone', description: 'Invalid phone number' },
  { phone: '5555678901', expectedStatus: 'restricted', description: 'Restricted number' }
];

async function testBadStatusPhones() {
  console.log('Starting tests for bad status phone numbers');
  console.log('============================================');
  
  // Since we can't control the RealPhoneValidation API responses directly,
  // we'll use a direct test of our validation hook function
  
  // Import the validation hook for testing
  const { validatePhoneDirectly } = await import('./app/lib/phone-validation-hook.js');
  
  // Monkey patch the fetch function to simulate different API responses
  const originalFetch = global.fetch;
  
  // Setup a counter to track results
  let passed = 0;
  let failed = 0;
  
  // Test each phone status
  for (const testCase of PHONE_STATUSES) {
    console.log(`\nTesting ${testCase.description}: ${testCase.phone}`);
    
    // Override fetch to return the desired status
    global.fetch = async (url) => {
      console.log(`Simulating API call for ${testCase.phone} with status: ${testCase.expectedStatus}`);
      
      // Return a mock response with the desired status
      return {
        ok: true,
        text: async () => JSON.stringify({
          status: testCase.expectedStatus,
          error_text: '',
          phone_type: 'Landline' // Not VoIP for this test, focusing on status
        })
      };
    };
    
    try {
      // Call the validation function
      const result = await validatePhoneDirectly(testCase.phone);
      
      // Check if the result is as expected (should be invalid for bad statuses)
      if (!result.isValid) {
        console.log(`✅ PASSED: ${testCase.phone} with status "${testCase.expectedStatus}" was correctly rejected`);
        console.log(`   Reason: ${result.reason}`);
        passed++;
      } else {
        console.log(`❌ FAILED: ${testCase.phone} with status "${testCase.expectedStatus}" was incorrectly accepted`);
        console.log(`   Expected to be rejected but was accepted`);
        failed++;
      }
    } catch (error) {
      console.error(`Error testing ${testCase.phone}:`, error);
      failed++;
    }
  }
  
  // Now test a lead submission with a disconnected number
  console.log('\nTesting lead submission API with a disconnected number');
  
  // Restore original fetch for the real API call
  global.fetch = originalFetch;
  
  // Create a test lead with a "disconnected" phone number
  const testLead = {
    firstName: "Test",
    lastName: "Disconnected",
    email: "test.disconnected@example.com",
    phone: "5551234567", // This should be simulated as disconnected
    listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
    campaignId: "onpoint-campaign-1",
    state: "CA",
    zipCode: "90210",
    incomeBracket: "$50,000-$75,000",
    homeownerStatus: "Renter",
    dob: "1985-05-15",
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53"
  };
  
  console.log('Sending test lead with phone:', testLead.phone);
  
  try {
    // Before making the API call, override fetch again to simulate a disconnected number
    // but only for the validatePhoneDirectly call, not for the entire API call
    const originalValidatePhoneDirectly = await import('./app/lib/phone-validation-hook.js').then(m => m.validatePhoneDirectly);
    const patchedValidatePhoneDirectly = async (phoneNumber) => {
      // For this specific test phone, return a disconnected result
      if (phoneNumber === '5551234567') {
        return {
          isValid: false,
          reason: 'Phone has invalid status: disconnected',
          phoneType: 'Landline',
          status: 'disconnected'
        };
      }
      // Otherwise use the original function
      return originalValidatePhoneDirectly(phoneNumber);
    };
    
    // Monkey patch the function
    await import('./app/lib/phone-validation-hook.js').then(m => {
      m.validatePhoneDirectly = patchedValidatePhoneDirectly;
    });
    
    // Now make the actual API call
    const response = await fetch('http://localhost:3001/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(testLead)
    });
    
    console.log('Response status:', response.status);
    
    const result = await response.json();
    
    if (response.status === 400 && !result.success) {
      console.log('✅ PASSED: Lead with disconnected number was correctly rejected');
      console.log('Error:', result.error);
      console.log('Details:', JSON.stringify(result.details, null, 2));
      passed++;
    } else {
      console.log('❌ FAILED: Lead with disconnected number was incorrectly accepted');
      console.log('Result:', JSON.stringify(result, null, 2));
      failed++;
    }
  } catch (error) {
    console.error('Error testing lead submission:', error);
    failed++;
  }
  
  // Print summary
  console.log('\n============================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('============================================');
  
  // Restore the original fetch
  global.fetch = originalFetch;
}

// Run the tests
testBadStatusPhones().catch(console.error);
