// End-to-end test for lead posting with compliance checking
const dirtyNumber = '1234567890'; // Expected to fail compliance
const cleanNumber = '4083109269'; // Expected to pass compliance

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

async function testLead(phone, description) {
  console.log(`\nTEST: Submit lead with ${description} (${phone})`);
  try {
    console.log(`Sending request to ${leadsApiUrl} with phone ${phone}...`);
    
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
        phone: phone,
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
      if (response.status === 400 && description === 'dirty number') {
        console.log('✅ PASS: Dirty number correctly rejected (HTTP 400)');
        return;
      }
    }
    
    const data = await response.json();
    console.log(`Lead API Response for ${description}:`);
    console.log(JSON.stringify(data, null, 2));
    
    if (description === 'dirty number') {
      // Check if lead with dirty number gets rejected
      if (!data.success || data.bid === 0) {
        console.log('✅ PASS: Dirty number correctly rejected\n');
      } else {
        console.log('❌ FAIL: Dirty number should be rejected\n');
      }
    } else {
      // Check if lead with clean number gets normal bid
      if (data.success && (data.bid === undefined || data.bid > 0)) {
        console.log('✅ PASS: Clean number correctly accepted\n');
      } else {
        console.log('❌ FAIL: Clean number should be accepted\n');
      }
    }
  } catch (error) {
    console.error(`Error in test with ${description}:`, error);
    
    // Special handling for timeout errors
    if (error.name === 'AbortError') {
      console.log('Request timed out. This could be due to server load or an issue with the API.');
    }
  }
}

async function runTests() {
  console.log('===========================================');
  console.log('  END-TO-END LEAD COMPLIANCE TEST  ');
  console.log('===========================================\n');

  // Test 1: Submit lead with dirty number (should fail)
  await testLead(dirtyNumber, 'dirty number');
  
  // Test 2: Submit lead with clean number (should pass)
  await testLead(cleanNumber, 'clean number');

  console.log('===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
