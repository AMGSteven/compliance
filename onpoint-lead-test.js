/**
 * Live Test: Lead Submission with OnPoint List ID
 * 
 * This test verifies:
 * 1. All 6 services are checked before allowing a lead
 * 2. Accepted leads return a bid of $0.50
 * 3. Rejected leads return a bid of $0 and indicate rejection
 */
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const API_KEY = 'test_key_123';
const ONPOINT_LIST_ID = '1b759535-2a5e-421e-9371-3bde7f855c60';

// Test cases: valid and invalid leads
const testLeads = [
  {
    type: 'VALID',
    lead: {
      firstName: "John",
      lastName: "Doe",
      email: "valid.test@example.com",
      phone: "6507769592", // Valid number that should pass
      state: "CA",
      zipCode: "90210",
      incomeBracket: "$50,000-$75,000",
      homeownerStatus: "Renter",
      ageRange: "35-44",
      listId: ONPOINT_LIST_ID,
      campaignId: "test-campaign",
      trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295"
    }
  },
  {
    type: 'INVALID (VoIP)',
    lead: {
      firstName: "Jane",
      lastName: "Smith",
      email: "voip.test@example.com",
      phone: "9295551234", // VoIP number that should be rejected
      state: "CA",
      zipCode: "90210",
      incomeBracket: "$50,000-$75,000",
      homeownerStatus: "Renter",
      ageRange: "35-44",
      listId: ONPOINT_LIST_ID,
      campaignId: "test-campaign",
      trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295"
    }
  }
];

async function submitLead(testCase) {
  console.log(`\n=============================================`);
  console.log(`TESTING ${testCase.type} LEAD SUBMISSION`);
  console.log(`=============================================`);
  
  try {
    console.log(`Submitting lead with phone: ${testCase.lead.phone}`);
    
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testCase.lead)
    });
    const endTime = Date.now();
    
    console.log(`Response time: ${endTime - startTime}ms`);
    console.log(`Status code: ${response.status}`);
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Validate the response
    if (response.ok && result.success) {
      console.log(`\n✅ Lead was ACCEPTED`);
      console.log(`Lead ID: ${result.lead_id || result.data?.id || 'Not provided'}`);
      
      // Check bid amount
      if (result.bid === 0.5) {
        console.log(`✅ Correct bid amount: $0.50`);
      } else {
        console.log(`❌ Incorrect bid amount: $${result.bid} (expected $0.50)`);
      }
    } else {
      console.log(`\n❌ Lead was REJECTED`);
      
      // Check if rejection reason is provided
      if (result.error) {
        console.log(`✅ Rejection reason provided: "${result.error}"`);
      } else {
        console.log(`❌ No rejection reason provided`);
      }
      
      // Check bid amount for rejected lead
      if (result.bid === 0) {
        console.log(`✅ Correct bid amount for rejected lead: $0.00`);
      } else {
        console.log(`❌ Incorrect bid amount: $${result.bid} (expected $0.00)`);
      }
      
      // Check if detailed results are provided
      if (result.details && result.details.failedSources) {
        console.log(`\n✅ Failed sources provided: ${result.details.failedSources.join(', ')}`);
        
        // Count the number of services that were checked
        const totalServices = result.details.complianceResults?.length || 0;
        console.log(`✅ Number of services checked: ${totalServices}/6`);
        
        if (totalServices === 6) {
          console.log(`✅ All 6 services were checked`);
        } else {
          console.log(`❌ Not all services were checked (${totalServices}/6)`);
        }
      } else {
        console.log(`❌ No detailed results provided`);
      }
    }
  } catch (error) {
    console.error(`Error submitting ${testCase.type} lead:`, error.message);
  }
}

async function runTest() {
  console.log(`\n=================================================`);
  console.log(`  LIVE TEST: LEAD SUBMISSION WITH ONPOINT LIST ID  `);
  console.log(`=================================================`);
  
  // Submit each test lead
  for (const testCase of testLeads) {
    await submitLead(testCase);
  }
  
  console.log(`\n=================================================`);
  console.log(`                 TEST COMPLETE                   `);
  console.log(`=================================================`);
}

// Run the test
runTest();
