// Test script specifically for standard lead submission with detailed error logging
import fetch from 'node-fetch';

// Valid phone number that should pass all compliance checks
const phoneNumber = "3104567890";

async function testStandardLeadWithDetails() {
  console.log(`\n----- Testing standard lead with phone: ${phoneNumber} -----`);
  
  const lead = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: phoneNumber,
    listId: "1b759535-2a5e-421e-9371-3bde7f855c60", // Real Onpoint list ID
    campaignId: "test-campaign-1",
    state: "CA",
    zipCode: "90210",
    incomeBracket: "$50,000-$75,000", // Required compliance field
    homeownerStatus: "Renter", // Required compliance field
    dob: "1980-01-01", // Using DOB instead of ageRange for better compliance
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53"
  };
  
  try {
    console.log('Sending lead data:', JSON.stringify(lead, null, 2));
    
    const response = await fetch('http://localhost:3004/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(lead)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Full response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('Success:', result.success);
      if (result.data) {
        console.log('Lead ID:', result.data.id);
        console.log('Bid Value:', result.data.bid);
      }
    } else {
      console.log('Failed:', result.error);
      if (result.details) {
        console.log('Error details:', JSON.stringify(result.details, null, 2));
      }
    }
  } catch (error) {
    console.error('Request error:', error.message);
  }
}

// Run the test
testStandardLeadWithDetails();
