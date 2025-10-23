/**
 * Test script to verify vertical state validation is working
 * 
 * This will:
 * 1. Disable a state (e.g., California) for ACA vertical
 * 2. Try to submit a lead from that state
 * 3. Verify it gets rejected with the correct error message
 */

const API_KEY = 'test_key_123'; // Your test API key
const BASE_URL = 'http://localhost:3000';

async function testVerticalStateValidation() {
  console.log('🧪 Testing Vertical State Validation\n');
  
  // Step 1: Disable Alabama (AL) for ACA vertical
  // AL is allowed for both Internal and Pitch BPO dialers, so it will pass dialer check
  console.log('Step 1: Disabling Alabama (AL) for ACA vertical...');
  const disableResponse = await fetch(`${BASE_URL}/api/vertical-states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vertical: 'ACA',
      state_code: 'AL',
      is_allowed: false,
      notes: 'Test: Temporarily disabled for testing'
    })
  });
  
  const disableResult = await disableResponse.json();
  console.log('✅ AL disabled:', disableResult.success ? 'Success' : 'Failed');
  console.log('');
  
  // Step 2: Try to submit a lead from Alabama
  console.log('Step 2: Submitting test lead from Alabama...');
  const leadResponse = await fetch(`${BASE_URL}/api/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '6507769592', // Your test number - bypasses some checks
      state: 'AL',
      zip_code: '90210',
      list_id: 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e', // Juiced Media list (ACA vertical)
      campaign_id: 'b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00',
      dob: '1990-01-01',
      address: '123 Test St',
      city: 'Los Angeles',
      trusted_form_cert_url: 'https://cert.trustedform.com/test123',
      income_bracket: '50000-75000',
      homeowner_status: 'own',
      source: 'test'
    })
  });
  
  const leadResult = await leadResponse.json();
  
  console.log('\n📊 Lead Submission Result:');
  console.log('Status:', leadResponse.status);
  console.log('Success:', leadResult.success);
  console.log('Error:', leadResult.error || 'None');
  console.log('Details:', JSON.stringify(leadResult.details || {}, null, 2));
  
  if (!leadResult.success && leadResult.error?.includes('not approved for ACA vertical')) {
    console.log('\n✅ VERTICAL STATE VALIDATION IS WORKING!');
    console.log('   Lead was correctly rejected because CA is not approved for ACA vertical');
  } else if (leadResult.success) {
    console.log('\n⚠️  WARNING: Lead was accepted when it should have been rejected!');
    console.log('   The vertical state check may not be working correctly.');
  } else {
    console.log('\n❓ Lead was rejected, but for a different reason:');
    console.log('   Error:', leadResult.error);
  }
  
  // Step 3: Re-enable Alabama
  console.log('\nStep 3: Re-enabling Alabama for ACA vertical...');
  const enableResponse = await fetch(`${BASE_URL}/api/vertical-states`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vertical: 'ACA',
      state_code: 'AL',
      is_allowed: true,
      notes: 'Re-enabled after test'
    })
  });
  
  const enableResult = await enableResponse.json();
  console.log('✅ AL re-enabled:', enableResult.success ? 'Success' : 'Failed');
  
  console.log('\n🎉 Test complete!\n');
}

// Run the test
testVerticalStateValidation().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
