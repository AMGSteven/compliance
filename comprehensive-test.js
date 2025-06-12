// Comprehensive test for Synergy DNC integration
const dncNumber = '9317167522'; // Known to return internal_dnc
const cleanNumber = '6507769592'; // Known to be clean

const apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';
const complianceCheckUrl = 'http://localhost:3003/api/check-compliance';
const leadsApiUrl = 'http://localhost:3003/api/leads';
const apiKey = 'test_key_123';

async function runTests() {
  console.log('===========================================');
  console.log('  COMPREHENSIVE SYNERGY DNC INTEGRATION TEST ');
  console.log('===========================================\n');

  // Test 1: Direct API check for DNC number
  console.log('TEST 1: Direct Synergy API check for DNC number');
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: dncNumber })
    });
    
    const data = await response.json();
    console.log(`Response for ${dncNumber}:`);
    console.log(`- Accepted: ${data.accepted}`);
    console.log(`- Rejection Reason: ${data.rejection_reason}`);
    
    if (data.rejection_reason === 'internal_dnc') {
      console.log('✅ PASS: Number correctly identified as DNC\n');
    } else {
      console.log('❌ FAIL: Number not identified as DNC\n');
    }
  } catch (error) {
    console.error('Error in Test 1:', error);
  }

  // Test 2: Direct API check for clean number
  console.log('TEST 2: Direct Synergy API check for clean number');
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: cleanNumber })
    });
    
    const data = await response.json();
    console.log(`Response for ${cleanNumber}:`);
    console.log(`- Accepted: ${data.accepted}`);
    console.log(`- Rejection Reason: ${data.rejection_reason || 'None'}`);
    
    if (data.rejection_reason !== 'internal_dnc') {
      console.log('✅ PASS: Number correctly not flagged as DNC\n');
    } else {
      console.log('❌ FAIL: Number incorrectly flagged as DNC\n');
    }
  } catch (error) {
    console.error('Error in Test 2:', error);
  }

  // Test 3: Submit lead with DNC number
  console.log('TEST 3: Submit lead with DNC number');
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
        phone: dncNumber,
        state: "CA",
        zipCode: "90210",
        listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
        campaignId: "test-campaign",
        incomeBracket: "50000-75000",
        homeownerStatus: "owner",
        ageRange: "30-40"
      })
    });
    
    const data = await response.json();
    console.log('Lead API Response for DNC number:');
    console.log(`- Success: ${data.success}`);
    console.log(`- Bid: ${data.bid}`);
    
    // Check if lead with DNC number gets $0 bid
    if (data.bid === 0) {
      console.log('✅ PASS: Lead with DNC number correctly gets $0 bid\n');
    } else {
      console.log('❌ FAIL: Lead with DNC number should get $0 bid\n');
    }
  } catch (error) {
    console.error('Error in Test 3:', error);
  }

  // Test 4: Submit lead with clean number
  console.log('TEST 4: Submit lead with clean number');
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
        incomeBracket: "50000-75000",
        homeownerStatus: "owner",
        ageRange: "30-40"
      })
    });
    
    const data = await response.json();
    console.log('Lead API Response for clean number:');
    console.log(`- Success: ${data.success}`);
    console.log(`- Bid: ${data.bid}`);
    
    // Check if lead with clean number gets normal bid
    if (data.bid > 0) {
      console.log('✅ PASS: Lead with clean number correctly gets normal bid\n');
    } else {
      console.log('❌ FAIL: Lead with clean number should get normal bid\n');
    }
  } catch (error) {
    console.error('Error in Test 4:', error);
  }

  console.log('===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
