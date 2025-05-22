// Comprehensive end-to-end test for lead posting with compliance checking
const dirtyNumber = '9317167522'; // Known to be on DNC list
const cleanNumber = '6507769592'; // Known to be clean

// API endpoints
const synergyDncApiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';
const leadsApiUrl = 'http://localhost:3004/api/leads';
const apiKey = 'test_key_123';

// Correct IDs from list routing system
const correctListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
const correctToken = '1291bc7e6c29ee7421953f8925c25c03';

// Test 1: Direct Synergy DNC API check
async function testSynergyDncApi(phoneNumber, description) {
  console.log(`\nTEST 1: Direct Synergy API check for ${description} (${phoneNumber})`);
  
  try {
    const response = await fetch(synergyDncApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: phoneNumber })
    });
    
    const data = await response.json();
    console.log(`Synergy API response for ${phoneNumber}:`);
    console.log(`- Rejection Reason: ${data.rejection_reason || 'None'}`);
    
    if (description === 'dirty number') {
      if (data.rejection_reason === 'internal_dnc') {
        console.log('✅ PASS: Number correctly identified as DNC by Synergy API\n');
        return true;
      } else {
        console.log('❌ FAIL: Number not identified as DNC by Synergy API\n');
        return false;
      }
    } else {
      if (!data.rejection_reason || data.rejection_reason !== 'internal_dnc') {
        console.log('✅ PASS: Number correctly not flagged as DNC by Synergy API\n');
        return true;
      } else {
        console.log('❌ FAIL: Number incorrectly flagged as DNC by Synergy API\n');
        return false;
      }
    }
  } catch (error) {
    console.error(`Error in Synergy DNC API test for ${description}:`, error);
    return false;
  }
}

// Test 2: Lead posting to compliance system
async function postLead(phoneNumber, description) {
  console.log(`\nTEST 2: Posting lead with ${description} (${phoneNumber})`);
  
  const payload = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: phoneNumber,
    state: "CA",
    zipCode: "90210",
    listId: correctListId,
    campaignId: "test-campaign",
    token: correctToken,
    trustedFormCertUrl: "https://cert.trustedform.com/example",
    incomeBracket: "50000-75000",
    homeownerStatus: "owner",
    ageRange: "30-40"
  };
  
  console.log(`Request payload for ${description}:`, JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(leadsApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Response status for ${description}: ${response.status}`);
    
    const isJson = response.headers.get('content-type')?.includes('application/json');
    
    if (isJson) {
      const data = await response.json();
      console.log(`Response data for ${description}:`, JSON.stringify(data, null, 2));
      
      if (description === 'dirty number') {
        // Check if lead with dirty number is rejected
        if (response.status === 400 || !data.success || data.bid === 0) {
          console.log('✅ PASS: Dirty number correctly rejected\n');
          return { success: true, isValid: false, data };
        } else {
          console.log('❌ FAIL: Dirty number should be rejected\n');
          return { success: false, isValid: true, data };
        }
      } else {
        // Check if lead with clean number is accepted
        if (response.status === 200 && data.success && data.bid > 0) {
          console.log('✅ PASS: Clean number correctly accepted\n');
          return { success: true, isValid: true, data };
        } else {
          console.log('❌ FAIL: Clean number should be accepted\n');
          return { success: false, isValid: false, data };
        }
      }
    } else {
      const text = await response.text();
      console.log(`Non-JSON response: ${text}`);
      return { success: false, isValid: false, error: text };
    }
  } catch (error) {
    console.error(`Error posting lead with ${description}:`, error);
    return { success: false, isValid: false, error: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('===========================================');
  console.log('  COMPREHENSIVE END-TO-END TEST  ');
  console.log('===========================================');

  // Test both numbers with the Synergy DNC API
  const dirtyDncResult = await testSynergyDncApi(dirtyNumber, 'dirty number');
  const cleanDncResult = await testSynergyDncApi(cleanNumber, 'clean number');
  
  // Test lead posting for both numbers
  const dirtyLeadResult = await postLead(dirtyNumber, 'dirty number');
  const cleanLeadResult = await postLead(cleanNumber, 'clean number');

  // Summarize the results
  console.log('\n===========================================');
  console.log('  TEST RESULTS SUMMARY  ');
  console.log('===========================================');
  console.log(`1. Dirty Number (${dirtyNumber}):`);
  console.log(`   - Synergy DNC API: ${dirtyDncResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Lead Posting: ${dirtyLeadResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`\n2. Clean Number (${cleanNumber}):`);
  console.log(`   - Synergy DNC API: ${cleanDncResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Lead Posting: ${cleanLeadResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n===========================================');
  
  // Overall system status
  const overallSuccess = dirtyDncResult && cleanDncResult && 
                         dirtyLeadResult.success && cleanLeadResult.success;
                         
  if (overallSuccess) {
    console.log('  ✅ OVERALL SYSTEM STATUS: WORKING CORRECTLY  ');
  } else {
    console.log('  ❌ OVERALL SYSTEM STATUS: ISSUES DETECTED  ');
  }
  console.log('===========================================');
}

runTests();
