// End-to-end test for lead posting with compliance checking
const dirtyNumber = '1234567890'; // Expected to fail compliance
const cleanNumber = '4083109269'; // Expected to pass compliance

const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

async function runTests() {
  console.log('===========================================');
  console.log('  END-TO-END LEAD COMPLIANCE TEST  ');
  console.log('===========================================\n');

  // Test 1: Submit lead with dirty number (should fail)
  console.log('TEST 1: Submit lead with dirty number (should fail)');
  try {
    const response = await fetch(leadsApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: dirtyNumber,
        state: "CA",
        zipCode: "90210",
        listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
        campaignId: "test-campaign",
        trustedFormCertUrl: "https://cert.trustedform.com/example",
        incomeBracket: "50000-75000",
        homeownerStatus: "owner",
        ageRange: "30-40"
      })
    });
    
    const data = await response.json();
    console.log('Lead API Response for dirty number:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if lead with dirty number gets rejected
    if (!data.success || data.bid === 0) {
      console.log('✅ PASS: Dirty number correctly rejected\n');
    } else {
      console.log('❌ FAIL: Dirty number should be rejected\n');
    }
  } catch (error) {
    console.error('Error in Test 1:', error);
  }

  // Test 2: Submit lead with clean number (should pass)
  console.log('TEST 2: Submit lead with clean number (should pass)');
  try {
    const response = await fetch(leadsApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: cleanNumber,
        state: "CA",
        zipCode: "90210",
        listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
        campaignId: "test-campaign",
        trustedFormCertUrl: "https://cert.trustedform.com/example",
        incomeBracket: "50000-75000",
        homeownerStatus: "owner",
        ageRange: "30-40"
      })
    });
    
    const data = await response.json();
    console.log('Lead API Response for clean number:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if lead with clean number gets normal bid
    if (data.success && (data.bid === undefined || data.bid > 0)) {
      console.log('✅ PASS: Clean number correctly accepted\n');
    } else {
      console.log('❌ FAIL: Clean number should be accepted\n');
    }
  } catch (error) {
    console.error('Error in Test 2:', error);
  }

  console.log('===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
