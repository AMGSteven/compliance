// Lead posting test with correct list ID and token
const cleanNumber = '4083109269'; // Expected to pass compliance
const dirtyNumber = '1234567890'; // Expected to fail compliance (internal_dnc)

// API endpoint
const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

// Correct IDs from list routing system
const correctListId = '1b759535-2a5e-421e-9371-3bde7f855c60';
const correctToken = '1291bc7e6c29ee7421953f8925c25c03';

// Utility function to post a lead
async function postLead(phoneNumber, description) {
  console.log(`\nPosting lead with ${description} (${phoneNumber})...`);
  
  const payload = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: phoneNumber,
    state: "CA",
    zipCode: "90210",
    listId: correctListId,
    campaignId: "test-campaign",
    token: correctToken, // Include the token as specified
    trustedFormCertUrl: "https://cert.trustedform.com/example",
    incomeBracket: "50000-75000",
    homeownerStatus: "owner",
    ageRange: "30-40"
  };
  
  console.log(`Request payload for ${description}:`, JSON.stringify(payload, null, 2));
  
  try {
    // Use AbortController for timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(leadsApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`Response status for ${description}: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Response data for ${description}:`, JSON.stringify(data, null, 2));
      return { success: true, data };
    } else {
      const text = await response.text();
      console.log(`Error response for ${description}:`, text);
      return { success: false, status: response.status, text };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Request for ${description} timed out after 15 seconds`);
      return { success: false, error: 'Request timed out' };
    }
    console.error(`Request error for ${description}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  console.log('===========================================');
  console.log('  LEAD POSTING TEST WITH CORRECT TOKEN  ');
  console.log('===========================================');
  
  // Test with clean number
  console.log('\nTEST 1: CLEAN NUMBER');
  const cleanResult = await postLead(cleanNumber, 'clean number');
  
  // Test with dirty number only if clean number test completed
  if (cleanResult.success) {
    console.log('\nTEST 2: DIRTY NUMBER');
    await postLead(dirtyNumber, 'dirty number');
  }
  
  console.log('\n===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
