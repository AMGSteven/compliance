// Simplified lead posting test using fetch
const cleanNumber = '4083109269'; // Expected to pass compliance

// API endpoint
const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

// Utility function to post a lead
async function postLead(phoneNumber) {
  console.log(`\nPosting lead with phone number: ${phoneNumber}`);
  
  const payload = {
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
  };
  
  console.log(`Request payload:`, JSON.stringify(payload, null, 2));
  
  try {
    // Use AbortController for timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
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
    
    console.log(`Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Response data:`, JSON.stringify(data, null, 2));
      return { success: true, data };
    } else {
      const text = await response.text();
      console.log(`Error response:`, text);
      return { success: false, status: response.status, text };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timed out after 10 seconds');
      return { success: false, error: 'Request timed out' };
    }
    console.error(`Request error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test
async function runTest() {
  console.log('===========================================');
  console.log('  SIMPLIFIED LEAD POSTING TEST  ');
  console.log('===========================================');
  
  const result = await postLead(cleanNumber);
  
  console.log('\nTest result:', result.success ? 'SUCCESS' : 'FAILED');
  
  console.log('\n===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTest();
