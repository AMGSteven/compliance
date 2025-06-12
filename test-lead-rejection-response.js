// Test script to show what a lead vendor would see when a lead is rejected due to DNC
import fetch from 'node-fetch';

async function testLeadRejection() {
  const dirtyNumber = '9317167522'; // Known DNC number
  
  console.log(`Testing lead posting with dirty number: ${dirtyNumber}`);
  
  // Create a sample lead payload with the dirty number
  const leadPayload = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: dirtyNumber,
    state: "CA",
    zipCode: "90210",
    listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
    campaignId: "test-campaign",
    token: "1291bc7e6c29ee7421953f8925c25c03",
    trustedFormCertUrl: "https://cert.trustedform.com/example",
    incomeBracket: "50000-75000",
    homeownerStatus: "owner",
    ageRange: "30-40"
  };
  
  try {
    // Post the lead to the leads API
    const response = await fetch('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test_key_123' // API key for authentication
      },
      body: JSON.stringify(leadPayload),
    });
    
    // Get the response status and data
    const status = response.status;
    const data = await response.json();
    
    console.log('\n===========================================');
    console.log('  LEAD VENDOR RESPONSE FOR REJECTED LEAD  ');
    console.log('===========================================');
    console.log(`HTTP Status: ${status}`);
    console.log('\nResponse Body:');
    console.log(JSON.stringify(data, null, 2));
    console.log('===========================================');
    
  } catch (error) {
    console.error('Error posting lead:', error);
  }
}

// Run the test
testLeadRejection();
