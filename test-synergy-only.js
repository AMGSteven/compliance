// Test script for Synergy DNC API with both test numbers
const dirtyNumber = '1234567890'; // Expected to fail compliance
const cleanNumber = '4083109269'; // Expected to pass compliance

// Synergy DNC API endpoint
const synergyDncApiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';

async function testSynergyDncApi(phoneNumber, description) {
  console.log(`\nTesting Synergy DNC API with ${description}: ${phoneNumber}`);
  
  try {
    const response = await fetch(synergyDncApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: phoneNumber })
    });
    
    const data = await response.json();
    console.log(`Response for ${phoneNumber}:`);
    console.log(JSON.stringify(data, null, 2));
    
    if (description === 'dirty number') {
      if (data.rejection_reason === 'internal_dnc') {
        console.log('✅ PASS: Number correctly identified as DNC by Synergy API\n');
      } else {
        console.log('❌ FAIL: Number not identified as DNC by Synergy API\n');
      }
    } else {
      if (!data.rejection_reason || data.rejection_reason !== 'internal_dnc') {
        console.log('✅ PASS: Number correctly not flagged as DNC by Synergy API\n');
      } else {
        console.log('❌ FAIL: Number incorrectly flagged as DNC by Synergy API\n');
      }
    }
  } catch (error) {
    console.error(`Error testing Synergy DNC API for ${description}:`, error);
  }
}

async function runTests() {
  console.log('===========================================');
  console.log('  SYNERGY DNC API TEST  ');
  console.log('===========================================');

  // Test both numbers with the Synergy DNC API
  await testSynergyDncApi(dirtyNumber, 'dirty number');
  await testSynergyDncApi(cleanNumber, 'clean number');

  console.log('===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
