// Simple lead test script
import fetch from 'node-fetch';

async function testLeadSubmission() {
  console.log('Testing lead submission with RealPhoneValidation API...');
  
  // Create a valid lead with all required fields
  const lead = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "3104567890", // Valid mobile number
    listId: "1b759535-2a5e-421e-9371-3bde7f855c60", // Onpoint list ID
    campaignId: "test-campaign-1",
    state: "CA",
    zipCode: "90210",
    incomeBracket: "$50,000-$75,000",
    homeownerStatus: "Renter",
    dob: "1980-01-01",
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53"
  };
  
  console.log('Sending lead data:', JSON.stringify(lead, null, 2));
  
  try {
    const response = await fetch('http://localhost:3005/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(lead),
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Response status:', response.status);
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCCESS! Lead submitted successfully');
      if (result.data) {
        console.log('Lead ID:', result.data.id);
        console.log('Bid value:', result.data.bid);
      }
    } else {
      console.log('❌ FAILED! Lead submission failed');
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ REQUEST ERROR:', error.message);
  }
}

testLeadSubmission().catch(err => {
  console.error('Unhandled error:', err);
});
