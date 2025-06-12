// Direct test script for RealPhoneValidation Turbo Standard API
import { checkPhoneCompliance } from './app/lib/real-phone-validation.js';

/**
 * This script directly tests the RealPhoneValidation Turbo Standard API implementation
 * using a simpler approach to confirm basic functionality:
 * 1. Mobile/landline numbers pass
 * 2. VoIP numbers are blocked
 * 3. Invalid numbers are blocked
 */

// Set environment variable to enable mock responses
process.env.USE_MOCK_RESPONSES = 'true';

async function testPhoneCompliance(phoneNumber, description) {
  console.log(`\n===== Testing ${phoneNumber} (${description}) =====`);
  
  try {
    const result = await checkPhoneCompliance(phoneNumber);
    
    console.log(`Compliant: ${result.isCompliant}`);
    
    if (!result.isCompliant) {
      console.log(`Reason: ${result.reason}`);
    }
    
    console.log('Details:');
    console.log(JSON.stringify(result.details, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error during test:', error);
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('TESTING REALPHONEVALIDATION TURBO STANDARD API CHANGES');
  console.log('======================================================');
  console.log('Testing with mock responses enabled\n');
  
  // Test cases
  await testPhoneCompliance('8005551212', 'Landline - should pass');
  await testPhoneCompliance('5125551234', 'Mobile - should pass');
  await testPhoneCompliance('9295551234', 'VoIP - should fail');
  await testPhoneCompliance('9999999999', 'Invalid - should fail');
  await testPhoneCompliance('123', 'Too short - should fail');
  
  console.log('\n======================================================');
  console.log('TEST SUMMARY');
  console.log('======================================================');
  console.log('If tests passed, you should see:');
  console.log('1. Landline and Mobile numbers: Compliant = true');
  console.log('2. VoIP numbers: Compliant = false with "VoIP numbers are not allowed"');
  console.log('3. Invalid numbers: Compliant = false with various error reasons');
  console.log('4. Response fields should include phoneType and isVoIP');
  console.log('======================================================');
}

runTests();
