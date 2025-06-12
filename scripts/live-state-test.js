/**
 * Live test for state validation in the lead submission API
 */

import fetch from 'node-fetch';

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m"
};

// Test states, including both allowed and disallowed
const testCases = [
  // Valid state, should be accepted
  {
    state: "TX",
    allowed: true,
    description: "Valid state (TX)"
  },
  // Invalid state, should be rejected specifically for state
  {
    state: "CA",
    allowed: false,
    description: "Invalid state (CA)"
  }
];

async function runLiveTest() {
  console.log(`${colors.blue}${colors.bold}🔍 LIVE TEST: STATE VALIDATION 🔍${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);

  for (const testCase of testCases) {
    console.log(`\n${colors.bold}Testing: ${testCase.description}${colors.reset}`);
    
    // Create test lead using the test case state
    const testLead = {
      firstName: "StateTest",
      lastName: "LiveValidation",
      email: "statetest@example.com",
      phone: "6507769592", // Using the test number you provided
      address: "123 Test St",
      city: "Test City",
      state: testCase.state,
      zipCode: "12345",
      listId: "94ec4eec-d409-422b-abbd-bd9ee35ce08a",
      campaignId: "test-campaign-id",
      incomeBracket: "$75,000-$100,000",
      homeownerStatus: "Homeowner",
      dob: "1980-05-15",
      source: "Live State Test",
      trustedFormCertUrl: "https://cert.trustedform.com/example",
      token: "be53740f04b40724b950c95d71e2528d"
    };
    
    try {
      console.log(`Sending lead with state: ${testCase.state}...`);
      
      const response = await fetch('https://compliance.juicedmedia.io/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testLead)
      });
      
      const data = await response.json();
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${JSON.stringify(data, null, 2)}`);
      
      // Check if the response matches our expectation for this test case
      if (testCase.allowed) {
        // For allowed states, we expect success or rejection for non-state reasons
        if (data.success) {
          console.log(`${colors.green}✅ PASS: Allowed state ${testCase.state} was accepted${colors.reset}`);
        } else if (data.error && data.error.includes('State not allowed')) {
          console.log(`${colors.red}❌ FAIL: Allowed state ${testCase.state} was incorrectly rejected due to state${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ INFO: Allowed state ${testCase.state} was rejected for other reasons${colors.reset}`);
          console.log(`Reason: ${data.error}`);
        }
      } else {
        // For disallowed states, we expect rejection specifically mentioning state
        if (!data.success && data.error && data.error.includes('State not allowed')) {
          console.log(`${colors.green}✅ PASS: Disallowed state ${testCase.state} was correctly rejected due to state${colors.reset}`);
        } else if (data.success) {
          console.log(`${colors.red}❌ FAIL: Disallowed state ${testCase.state} was incorrectly accepted${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ INFO: Disallowed state ${testCase.state} was rejected, but not explicitly due to state${colors.reset}`);
          console.log(`Reason: ${data.error}`);
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ ERROR: Test failed${colors.reset}`);
      console.error(error);
    }
  }

  console.log(`\n${colors.blue}${colors.bold}Live Test Complete${colors.reset}`);
}

// Run the live test
runLiveTest().catch(console.error);
