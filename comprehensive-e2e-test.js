'// Comprehensive end-to-end test for lead posting with compliance checking
const dirtyNumber = '1234567890'; // Expected to fail compliance
const cleanNumber = '4083109269'; // Expected to pass compliance

// API endpoints
const synergyDncApiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';
const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

// Utility function to make fetch requests with timeout handling
async function fetchWithTimeout(url, options, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Test direct Synergy DNC API call
async function testSynergyDncApi(phoneNumber, description) {
  console.log(`\nTEST: Direct Synergy API check for ${description} (${phoneNumber})`);
  try {
    const response = await fetchWithTimeout(synergyDncApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: phoneNumber })
    }, 60000);
    
    const data = await response.json();
    console.log(`Synergy API response for ${phoneNumber}:`);
    console.log(`- Accepted: ${data.accepted}`);
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

// Test lead submission
async function testLeadSubmission(phoneNumber, description, expectedDirty) {
  console.log(`\nTEST: Submit lead with ${description} (${phoneNumber})`);
  try {
    console.log(`Sending request to ${leadsApiUrl} with phone ${phoneNumber}...`);
    
    const response = await fetchWithTimeout(leadsApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        phone: phoneNumber,
        state: "CA",
        zipCode: "90210",
        listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
        campaignId: "test-campaign",
        trustedFormCertUrl: "https://cert.trustedform.com/example",
        incomeBracket: "50000-75000",
        homeownerStatus: "owner",
        ageRange: "30-40"
      })
    }, 60000); // 60 second timeout
    
    if (!response.ok) {
      console.log(`Server responded with status ${response.status}`);
      if (response.status === 400 && expectedDirty) {
        console.log('✅ PASS: Lead correctly rejected with HTTP 400\n');
        return true;
      } else {
        console.log(`❌ FAIL: Unexpected response status ${response.status}\n`);
        return false;
      }
    }
    
    const data = await response.json();
    console.log(`Lead API Response for ${description}:`);
    console.log(JSON.stringify(data, null, 2));
    
    if (expectedDirty) {
      // Check if lead with dirty number gets rejected
      if (!data.success || data.bid === 0) {
        console.log('✅ PASS: Dirty number correctly rejected by lead API\n');
        return true;
      } else {
        console.log('❌ FAIL: Dirty number should be rejected by lead API\n');
        return false;
      }
    } else {
      // Check if lead with clean number gets normal bid
      if (data.success && (data.bid === undefined || data.bid > 0)) {
        console.log('✅ PASS: Clean number correctly accepted by lead API\n');
        return true;
      } else {
        console.log('❌ FAIL: Clean number should be accepted by lead API\n');
        return false;
      }
    }
  } catch (error) {
    console.error(`Error in lead submission test with ${description}:`, error);
    
    // Special handling for timeout errors
    if (error.name === 'AbortError') {
      console.log('Request timed out. This could be due to server load or an issue with the API.');
    }
    return false;
  }
}

async function runTests() {
  console.log('===========================================');
  console.log('  COMPREHENSIVE END-TO-END COMPLIANCE TEST  ');
  console.log('===========================================\n');

  // First, test both numbers directly with the Synergy DNC API
  const dirtyDncResult = await testSynergyDncApi(dirtyNumber, 'dirty number');
  const cleanDncResult = await testSynergyDncApi(cleanNumber, 'clean number');
  
  // Then test lead submission for both numbers
  await testLeadSubmission(dirtyNumber, 'dirty number', true);
  await testLeadSubmission(cleanNumber, 'clean number', false);

  console.log('\n===========================================');
  console.log('  TEST RESULTS SUMMARY  ');
  console.log('===========================================');
  
  console.log(`Dirty number (${dirtyNumber}) Synergy DNC check: ${dirtyDncResult ? 'PASS' : 'FAIL'}`);
  console.log(`Clean number (${cleanNumber}) Synergy DNC check: ${cleanDncResult ? 'PASS' : 'FAIL'}`);
  console.log('===========================================');
}

runTests();
