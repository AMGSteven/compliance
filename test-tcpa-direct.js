// Direct test for TCPA Compliance Service
// This will bypass the API and directly test our service

import { TCPAComplianceChecker } from './lib/services/tcpa-compliance-service.js';

// Create the checker with credentials (using dummy values that will fail auth)
const tcpaChecker = new TCPAComplianceChecker({
  username: 'test_user',
  password: 'test_pass',
  maxRetries: 2,  // Set low to speed up test
  initialRetryDelay: 500,
  maxRetryDelay: 1000
});

async function testTcpaService() {
  console.log('======= TCPA COMPLIANCE SERVICE TEST =======');
  console.log('Testing individual phone check:');
  
  try {
    // Test the validation logic
    console.log('\n1. Testing phone validation:');
    const invalidPhone = 'not-a-phone';
    const invalidResult = await tcpaChecker.checkPhone(invalidPhone);
    console.log(`Phone: ${invalidPhone}`);
    console.log(`Valid: ${tcpaChecker.validatePhone(invalidPhone)}`);
    console.log(`Result:`, invalidResult);
    
    // Test valid phone format (will still fail due to invalid credentials)
    console.log('\n2. Testing valid phone format with API call:');
    const validPhone = '5551234567';
    console.log(`Phone: ${validPhone}`);
    console.log(`Valid: ${tcpaChecker.validatePhone(validPhone)}`);
    
    // This will make an actual API call that should fail with auth error
    // Testing that our retry logic and error handling work correctly
    const validResult = await tcpaChecker.checkPhone(validPhone);
    console.log(`Result:`, validResult);
    
    // Test batch processing
    console.log('\n3. Testing batch processing:');
    const phones = [
      { phone: '5551234567', name: 'Test User 1' },
      { phone: '5559876543', name: 'Test User 2' },
      { phone: 'invalid-number', name: 'Invalid User' }
    ];
    
    const batchResult = await tcpaChecker.checkPhones(phones);
    console.log('Batch check summary:');
    console.log(`- Total processed: ${batchResult.totalChecked}`);
    console.log(`- Compliant: ${batchResult.compliantCount}`);
    console.log(`- Non-compliant: ${batchResult.nonCompliantCount}`);
    console.log(`- Has errors: ${batchResult.hasErrors}`);
    console.log(`- Results: ${batchResult.results.length}`);
    
  } catch (error) {
    console.error('Unexpected error in test:', error);
  }
  
  console.log('\n=========== TEST COMPLETE ===========');
}

testTcpaService();
