// Test script for lead submission with comprehensive compliance checking
import fetch from 'node-fetch';

// Test phone numbers to try
const testPhones = [
  // Should fail for being invalid
  "9999999999",
  // VoIP number (Google Voice) - should be blocked by RealPhoneValidation
  "6502530000",
  // Valid mobile number that should pass all checks
  "3104567890",
  // Another test number
  "2104561212"
];

// Function to test standard lead submission
async function testStandardLeadSubmission(phoneNumber) {
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
    incomeBracket: "$50,000-$75,000",
    homeownerStatus: "Renter",
    ageRange: "35-44",
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53"
  };
  
  try {
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
    
    if (response.ok) {
      console.log('Success:', result.success);
      if (result.data) {
        console.log('Lead ID:', result.data.id);
      }
    } else {
      console.log('Failed:', result.error);
      if (result.details) {
        console.log('Failed Sources:', result.details.failedSources);
        console.log('Reasons:', result.details.reasons);
        
        // Check if phone validation was performed
        if (result.details.phoneValidation) {
          console.log('Phone Validation Result:', result.details.phoneValidation.isCompliant ? 'Valid' : 'Invalid');
          console.log('Phone Validation Details:', result.details.phoneValidation.details);
        } else {
          console.log('WARNING: Phone validation was not performed!');
        }
      }
    }
  } catch (error) {
    console.error('Request error:', error.message);
  }
}

// Function to test health insurance lead submission
async function testHealthInsuranceLeadSubmission(phoneNumber) {
  console.log(`\n----- Testing health insurance lead with phone: ${phoneNumber} -----`);
  
  const lead = {
    ApiToken: "7f108eff2dbf3ab07d562174da6dbe53", // Real token
    Vertical: "health",
    ListId: "1b759535-2a5e-421e-9371-3bde7f855c60", // Real Onpoint list ID
    ContactData: {
      FirstName: "Test",
      LastName: "User",
      Email: "test@example.com",
      Phone: phoneNumber,
      Address: "123 Test St",
      City: "Los Angeles",
      State: "CA",
      ZipCode: "90210"
    },
    Person: {
      IncomeBracket: "$50,000-$75,000",
      HomeownerStatus: "Renter",
      AgeRange: "35-44"
    },
    TrustedForm: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295"
  };
  
  try {
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
    
    if (response.ok) {
      console.log('Success:', result.success);
      if (result.lead_id) {
        console.log('Lead ID:', result.lead_id);
      }
    } else {
      console.log('Failed:', result.error);
      if (result.details) {
        console.log('Failed Sources:', result.details.failedSources);
        console.log('Reasons:', result.details.reasons);
        
        // Check if phone validation was performed
        if (result.details.phoneValidation) {
          console.log('Phone Validation Result:', result.details.phoneValidation.isCompliant ? 'Valid' : 'Invalid');
          console.log('Phone Validation Details:', result.details.phoneValidation.details);
        } else {
          console.log('WARNING: Phone validation was not performed!');
        }
      }
    }
  } catch (error) {
    console.error('Request error:', error.message);
  }
}

// Run the tests
async function runTests() {
  console.log('=== STARTING LEAD SUBMISSION COMPLIANCE TESTS ===');
  console.log('Testing all six compliance sources including RealPhoneValidation');
  
  for (const phone of testPhones) {
    await testStandardLeadSubmission(phone);
    await testHealthInsuranceLeadSubmission(phone);
  }
  
  console.log('\n=== COMPLETED LEAD SUBMISSION COMPLIANCE TESTS ===');
}

runTests();
