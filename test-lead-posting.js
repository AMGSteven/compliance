// Test script for lead posting with clean and dirty numbers
const cleanNumber = '4083109269'; // Expected to pass compliance
const dirtyNumber = '1234567890'; // Expected to fail compliance (internal_dnc)

// API endpoint
const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

// Utility function to post a lead
async function postLead(phoneNumber, description) {
  console.log(`\nPosting lead with ${description} (${phoneNumber})...`);
  
  try {
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
    
    console.log(`Request payload for ${description}:`, JSON.stringify(payload, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
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
      console.log(`Response for ${description}:`, JSON.stringify(data, null, 2));
      
      if (description === 'clean number') {
        console.log(`Clean number lead result: ${data.success ? 'ACCEPTED' : 'REJECTED'}`);
      } else {
        console.log(`Dirty number lead result: ${data.success ? 'ACCEPTED (ISSUE!)' : 'REJECTED (CORRECT)'}`);
      }
    } else {
      console.log(`Error status ${response.status} for ${description}`);
      try {
        const errorData = await response.json();
        console.log(`Error details:`, JSON.stringify(errorData, null, 2));
        
        if (description === 'dirty number' && response.status === 400) {
          console.log('Dirty number correctly rejected with 400 status');
        }
      } catch (e) {
        console.log(`Could not parse error response: ${e.message}`);
      }
    }
  } catch (error) {
    console.error(`Error posting lead with ${description}:`, error);
    
    if (error.name === 'AbortError') {
      console.log(`Request for ${description} timed out after 30 seconds`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('===========================================');
  console.log('  LEAD POSTING TEST  ');
  console.log('===========================================');
  
  console.log('\nTEST 1: POST CLEAN NUMBER');
  await postLead(cleanNumber, 'clean number');
  
  console.log('\nTEST 2: POST DIRTY NUMBER');
  await postLead(dirtyNumber, 'dirty number');
  
  console.log('\n===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
