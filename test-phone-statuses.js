// Test script to verify that bad status numbers are properly blocked
import fetch from 'node-fetch';

// Create a simplified version of the validatePhoneDirectly function
async function validatePhone(phoneNumber) {
  const API_KEY = process.env.REAL_PHONE_VALIDATION_API_KEY || '2699AA84-6478-493F-BF14-299F89BA9719';
  const API_URL = 'https://api.realvalidation.com/rpvWebService/Turbo.php';
  
  try {
    // Clean the phone number
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Build API request URL with parameters
    const params = new URLSearchParams({
      token: API_KEY,
      phone: formattedPhone,
      output: 'json'
    });
    
    const url = `${API_URL}?${params.toString()}`;
    console.log(`[TEST] Calling API: ${url}`);
    
    // Make direct fetch request to API
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    // Parse the response
    const responseText = await response.text();
    console.log(`[TEST] Raw API response: ${responseText}`);
    
    const data = JSON.parse(responseText);
    
    // Check if this is a VoIP number
    const isVoIP = data.phone_type?.toLowerCase() === 'voip';
    
    // Check for bad statuses - note that 'invalid-phone' needs to match what the API returns
    const badStatuses = ['disconnected', 'disconnected-70', 'unreachable', 'invalid phone', 'invalid-phone', 'restricted', 'busy', 'error'];
    const hasBadStatus = badStatuses.includes(data.status?.toLowerCase()) || 
                         (data.error_text && data.error_text.toLowerCase().includes('not valid'));
    
    // Determine if the phone is valid
    const isValid = !isVoIP && !hasBadStatus;
    
    return {
      isValid,
      phoneType: data.phone_type,
      status: data.status,
      reason: isVoIP ? 'VoIP numbers are not allowed' : 
              hasBadStatus ? `Phone has invalid status: ${data.status}` : 
              'Phone is valid'
    };
  } catch (error) {
    console.error('[TEST] Error:', error);
    return {
      isValid: false,
      reason: 'Error validating phone number'
    };
  }
}

// Numbers to test with the API
// Note: For the test case, these numbers might not have the exact statuses we expect
// The purpose is to show our validation logic works correctly based on whatever status the API returns
const testNumbers = [
  { phone: '8005551212', description: 'Standard test number (might be valid)' },
  { phone: '5105927935', description: 'Google Voice VoIP number (should be blocked)' },
  { phone: '5551234567', description: 'Random number (status varies)' },
  { phone: '0000000000', description: 'Invalid number (likely bad status)' }
];

async function runTests() {
  console.log('TESTING PHONE STATUS VALIDATION');
  console.log('==============================\n');
  
  for (const test of testNumbers) {
    console.log(`Testing ${test.description}: ${test.phone}`);
    
    try {
      const result = await validatePhone(test.phone);
      
      console.log(`API returned status: "${result.status}", phone type: "${result.phoneType}"`);
      console.log(`Validation result: ${result.isValid ? 'ACCEPTED' : 'BLOCKED'}`);
      
      if (!result.isValid) {
        console.log(`Block reason: ${result.reason}`);
      }
      
      // Show if this is correctly blocking bad numbers
      if (result.status && ['disconnected', 'disconnected-70', 'unreachable', 'invalid phone', 'restricted', 'busy'].includes(result.status.toLowerCase())) {
        if (!result.isValid) {
          console.log('✅ CORRECT: Number with bad status was properly blocked');
        } else {
          console.log('❌ ERROR: Number with bad status was incorrectly accepted');
        }
      }
      
      // Show if this is correctly blocking VoIP
      if (result.phoneType && result.phoneType.toLowerCase() === 'voip') {
        if (!result.isValid) {
          console.log('✅ CORRECT: VoIP number was properly blocked');
        } else {
          console.log('❌ ERROR: VoIP number was incorrectly accepted');
        }
      }
      
    } catch (error) {
      console.error(`Error testing ${test.phone}:`, error);
    }
    
    console.log('------------------------------\n');
  }
  
  console.log('Test completed. Check results above to verify bad statuses are being properly blocked.');
}

// Run the tests
runTests().catch(console.error);
