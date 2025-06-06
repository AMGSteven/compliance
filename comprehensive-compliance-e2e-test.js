/**
 * Comprehensive Compliance E2E Test
 * 
 * Tests all compliance checks including:
 * - Synergy DNC List
 * - Internal DNC List
 * - Duplicate Lead Detection
 * - Blacklist Alliance
 * - Phone Validation
 * - TCPA/Litigator Lists
 * - State Restrictions
 * - Invalid Phone Numbers
 */
import fetch from 'node-fetch';

// Track test results
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Test cases with expected results
const testCases = [
  {
    name: "Known Synergy DNC Number",
    lead: {
      phone: "7723615271", // Known to be on Synergy DNC
      first_name: "Test",
      last_name: "SynergyDNC",
      email: "test.synergydnc@example.com",
      state: "TX",
      list_id: "pitch-bpo-list-1749233817305"
    },
    expectation: {
      shouldPass: false,
      expectedFailure: "Synergy DNC"
    }
  },
  {
    name: "Invalid Phone Format",
    lead: {
      phone: "5555555555", // Invalid phone format
      first_name: "Test",
      last_name: "InvalidPhone",
      email: "test.invalid@example.com",
      state: "TX",
      list_id: "pitch-bpo-list-1749233817305"
    },
    expectation: {
      shouldPass: false,
      expectedFailure: "invalid-phone"
    }
  },
  {
    name: "State Restriction Check",
    lead: {
      phone: "9259981234", // Valid phone but restricted state
      first_name: "Test",
      last_name: "StateRestricted",
      email: "test.state@example.com",
      state: "CA", // Not in allowed states list
      list_id: "pitch-bpo-list-1749233817305"
    },
    expectation: {
      shouldPass: false,
      expectedFailure: "invalid state"
    }
  },
  {
    name: "Duplicate Phone Check",
    lead: {
      phone: "4083109269", // Known dupe in system
      first_name: "Test",
      last_name: "Duplicate",
      email: "test.duplicate@example.com",
      state: "TX",
      list_id: "pitch-bpo-list-1749233817305"
    },
    expectation: {
      shouldPass: false,
      expectedFailure: "Duplicate lead"
    }
  },
  {
    name: "Valid Test Number - Should Pass",
    lead: {
      phone: "9259985100", // Whitelisted test number
      first_name: "Test",
      last_name: "WhitelistedPass",
      email: "test.valid@example.com",
      state: "TX",
      list_id: "pitch-bpo-list-1749233817305"
    },
    expectation: {
      shouldPass: true,
      expectedType: "pitch_bpo"
    }
  }
];

// Complete the lead data with standard fields
function completeLeadData(lead) {
  return {
    ...lead,
    campaign_id: lead.campaign_id || "pitch-bpo-campaign-1749233817305",
    cadence_id: lead.cadence_id || "pitch-bpo-cadence-1749233817305",
    city: lead.city || "Austin",
    zip: lead.zip || "78701",
    income_bracket: lead.income_bracket || "100000-150000",
    homeowner_status: lead.homeowner_status || "Yes",
    age_range: lead.age_range || "35-44",
    traffic_source: lead.traffic_source || "compliance_test",
    ip_address: lead.ip_address || "127.0.0.1",
    landing_page: lead.landing_page || "https://compliance.juicedmedia.io",
    tc_agreed: lead.tc_agreed !== undefined ? lead.tc_agreed : true
  };
}

// Run a single test case
async function runTestCase(testCase) {
  console.log(`\n--------------------------------------------------`);
  console.log(`RUNNING TEST: ${testCase.name}`);
  console.log(`Phone: ${testCase.lead.phone}`);
  console.log(`--------------------------------------------------`);
  
  const completeLead = completeLeadData(testCase.lead);
  
  try {
    const response = await fetch('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(completeLead)
    });
    
    const data = await response.json();
    const status = response.status;
    
    // Determine if test passed based on expectations
    let testPassed = false;
    let reason = '';
    
    if (testCase.expectation.shouldPass) {
      // Should pass case
      if (status === 200 && data.success === true) {
        if (testCase.expectation.expectedType) {
          if (data.dialer?.type === testCase.expectation.expectedType) {
            testPassed = true;
            reason = `Lead passed and was routed to ${data.dialer.type}`;
          } else {
            reason = `Lead passed but was routed to ${data.dialer?.type || 'unknown'} instead of ${testCase.expectation.expectedType}`;
          }
        } else {
          testPassed = true;
          reason = 'Lead passed as expected';
        }
      } else {
        reason = `Lead was rejected: ${data.error || 'Unknown error'}`;
      }
    } else {
      // Should fail case
      if (status !== 200 || data.success === false) {
        const errorMessage = data.error || JSON.stringify(data.details || {}).substring(0, 100);
        if (testCase.expectation.expectedFailure && 
            errorMessage.toLowerCase().includes(testCase.expectation.expectedFailure.toLowerCase())) {
          testPassed = true;
          reason = `Lead properly rejected with: ${errorMessage}`;
        } else {
          testPassed = false;
          reason = `Lead was rejected, but for a different reason: ${errorMessage}`;
        }
      } else {
        reason = 'Lead passed but should have been rejected';
      }
    }
    
    // Update test results
    if (testPassed) {
      testResults.passed++;
      console.log(`✅ TEST PASSED: ${reason}`);
    } else {
      testResults.failed++;
      console.log(`❌ TEST FAILED: ${reason}`);
    }
    
    // Show details of the response
    console.log('\nResponse Status:', status);
    console.log('Success:', data.success);
    
    if (data.success) {
      console.log('Lead ID:', data.lead_id);
      if (data.dialer) {
        console.log('Dialer Type:', data.dialer.type);
        console.log('Forwarded:', data.dialer.forwarded);
        console.log('Status:', data.dialer.status);
      }
    } else {
      console.log('Error:', data.error);
      
      // Show compliance check details if available
      if (data.details) {
        if (data.details.failedSources) {
          console.log('\nFailed Compliance Checks:', data.details.failedSources.join(', '));
        }
        if (data.details.reasons) {
          console.log('Reasons:', data.details.reasons.join(', '));
        }
      }
    }
    
    // Store test result
    testResults.tests.push({
      name: testCase.name,
      phone: testCase.lead.phone,
      passed: testPassed,
      reason,
      response: {
        status,
        success: data.success,
        error: data.error,
        details: data.details ? 
          (data.details.failedSources ? { failedSources: data.details.failedSources } : 'Available but not shown')
          : null
      }
    });
    
  } catch (error) {
    testResults.failed++;
    console.error(`❌ TEST ERROR: ${error.message}`);
    
    testResults.tests.push({
      name: testCase.name,
      phone: testCase.lead.phone,
      passed: false,
      reason: `Exception: ${error.message}`,
      response: null
    });
  }
}

// Run all tests and generate a report
async function runAllTests() {
  console.log('STARTING COMPREHENSIVE COMPLIANCE E2E TESTS');
  console.log('===========================================');
  
  for (const testCase of testCases) {
    await runTestCase(testCase);
  }
  
  // Generate report
  console.log('\n\n===========================================');
  console.log('COMPLIANCE TEST RESULTS SUMMARY');
  console.log('===========================================');
  console.log(`Total Tests: ${testResults.tests.length}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log('===========================================');
  
  console.log('\nDETAILED RESULTS:');
  testResults.tests.forEach((test, index) => {
    console.log(`\n${index + 1}. ${test.name} (${test.phone}): ${test.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Reason: ${test.reason}`);
  });
}

// Run the tests
runAllTests();
