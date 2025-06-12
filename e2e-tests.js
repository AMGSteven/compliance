/**
 * End-to-End Test Suite for Compliance System
 * 
 * This script performs comprehensive testing of:
 * 1. Compliance Checker API (all 6 services)
 * 2. DNC functionality
 * 3. Lead submission with compliance checking
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:3003'; // Using port 3003 as shown in the server logs
const API_KEY = 'test_key_123';
const ONPOINT_LIST_ID = '1b759535-2a5e-421e-9371-3bde7f855c60';

// Test phone numbers
const TEST_PHONES = {
  VALID: '6507769592', // Valid number that should pass all checks
  TCPA_FLAGGED: '1234567890', // Known to be flagged by TCPA
  INVALID: '9999999999', // Invalid number
  VOIP: '9295551234',   // VoIP number (simulated)
  SHORT: '123',         // Too short to be valid
};

// Test suite colors for better visibility
const Colors = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
};

/**
 * 1. TEST DIRECT COMPLIANCE CHECKER API
 * Tests the /api/check-compliance endpoint that should use all 6 services
 */
async function testComplianceChecker() {
  console.log(`${Colors.BLUE}========== TESTING COMPLIANCE CHECKER API ==========${Colors.RESET}`);
  
  // Test each phone number with the compliance checker
  for (const [type, phone] of Object.entries(TEST_PHONES)) {
    console.log(`\n${Colors.YELLOW}Testing ${type} phone: ${phone}${Colors.RESET}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/check-compliance?phone=${phone}`, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY
        }
      });
      
      const result = await response.json();
      console.log(`Status code: ${response.status}`);
      
      if (type === 'VALID') {
        if (result.isCompliant) {
          console.log(`${Colors.GREEN}✓ PASS: Valid number correctly identified as compliant${Colors.RESET}`);
        } else {
          console.log(`${Colors.RED}✗ FAIL: Valid number incorrectly rejected${Colors.RESET}`);
          console.log('Rejection details:', result);
        }
      } else {
        if (!result.isCompliant) {
          console.log(`${Colors.GREEN}✓ PASS: ${type} number correctly rejected${Colors.RESET}`);
          console.log('Rejection reason:', result.reason || 'No reason provided');
          
          // Verify which services flagged the number
          if (result.results) {
            const services = result.results.map(r => r.source);
            console.log('Services that performed checks:', services.join(', '));
            
            // Count the number of services that ran
            console.log(`Total services checked: ${services.length}/6`);
            
            if (services.length < 6) {
              console.log(`${Colors.YELLOW}⚠️ WARNING: Not all 6 services ran checks${Colors.RESET}`);
            }
          }
        } else {
          console.log(`${Colors.RED}✗ FAIL: ${type} number incorrectly accepted${Colors.RESET}`);
        }
      }
    } catch (error) {
      console.error(`${Colors.RED}ERROR testing compliance for ${type} (${phone}):${Colors.RESET}`, error.message);
    }
  }
}

/**
 * 2. TEST DNC FUNCTIONALITY
 * Tests the DNC (Do Not Call) endpoints
 */
async function testDNCFunctionality() {
  console.log(`\n${Colors.BLUE}========== TESTING DNC FUNCTIONALITY ==========${Colors.RESET}`);
  
  const testPhone = '5551234567';
  
  // First add a number to DNC
  console.log(`${Colors.YELLOW}Adding ${testPhone} to DNC list${Colors.RESET}`);
  try {
    const addResponse = await fetch(`${BASE_URL}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        phone: testPhone,
        reason: 'E2E Testing'
      })
    });
    
    const addResult = await addResponse.json();
    console.log(`Status code: ${addResponse.status}`);
    
    if (addResponse.ok) {
      console.log(`${Colors.GREEN}✓ PASS: Successfully added number to DNC${Colors.RESET}`);
      console.log('DNC Entry ID:', addResult.id);
    } else {
      console.log(`${Colors.RED}✗ FAIL: Failed to add number to DNC${Colors.RESET}`);
      console.log('Error details:', addResult);
    }
    
    // Now verify the number is in DNC by checking compliance
    console.log(`\n${Colors.YELLOW}Verifying ${testPhone} is blocked by internal DNC${Colors.RESET}`);
    const complianceResponse = await fetch(`${BASE_URL}/api/check-compliance?phone=${testPhone}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    const complianceResult = await complianceResponse.json();
    
    if (!complianceResult.isCompliant) {
      const dncCheck = complianceResult.results?.find(r => r.source === 'Internal DNC');
      if (dncCheck && !dncCheck.compliant) {
        console.log(`${Colors.GREEN}✓ PASS: Number correctly blocked by Internal DNC${Colors.RESET}`);
      } else {
        console.log(`${Colors.YELLOW}⚠️ WARNING: Number rejected but not by Internal DNC${Colors.RESET}`);
      }
    } else {
      console.log(`${Colors.RED}✗ FAIL: Number was not blocked despite being in DNC${Colors.RESET}`);
    }
  } catch (error) {
    console.error(`${Colors.RED}ERROR testing DNC functionality:${Colors.RESET}`, error.message);
  }
}

/**
 * 3. TEST LEAD SUBMISSION
 * Tests submitting leads and verifies they're checked against all compliance services
 */
async function testLeadSubmission() {
  console.log(`\n${Colors.BLUE}========== TESTING LEAD SUBMISSION ==========${Colors.RESET}`);
  
  // Create test leads with different phone numbers
  const testLeads = Object.entries(TEST_PHONES).map(([type, phone]) => ({
    type,
    lead: {
      firstName: "Test",
      lastName: "User",
      email: `test.${type.toLowerCase()}@example.com`,
      phone: phone,
      state: "CA",
      zipCode: "90210",
      incomeBracket: "$50,000-$75,000",
      homeownerStatus: "Renter",
      ageRange: "35-44",
      listId: ONPOINT_LIST_ID,
      campaignId: "test-campaign",
      trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295"
    }
  }));
  
  // Submit each lead and verify the response
  for (const {type, lead} of testLeads) {
    console.log(`\n${Colors.YELLOW}Submitting ${type} lead with phone: ${lead.phone}${Colors.RESET}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(lead)
      });
      
      const result = await response.json();
      console.log(`Status code: ${response.status}`);
      
      if (type === 'VALID') {
        if (response.ok && result.success) {
          console.log(`${Colors.GREEN}✓ PASS: Valid lead accepted${Colors.RESET}`);
          console.log('Lead ID:', result.lead_id || result.data?.id);
          console.log('Bid:', result.bid);
        } else {
          console.log(`${Colors.RED}✗ FAIL: Valid lead rejected${Colors.RESET}`);
          console.log('Rejection details:', result);
        }
      } else {
        if (!response.ok || !result.success) {
          console.log(`${Colors.GREEN}✓ PASS: ${type} lead correctly rejected${Colors.RESET}`);
          console.log('Rejection reason:', result.error);
          
          if (result.details) {
            console.log('Failed sources:', result.details.failedSources?.join(', '));
            
            // Check if phone validation was performed
            if (result.details.phoneValidation) {
              console.log(`${Colors.GREEN}✓ Phone validation was performed${Colors.RESET}`);
            } else {
              console.log(`${Colors.YELLOW}⚠️ WARNING: Phone validation may not have been performed${Colors.RESET}`);
            }
            
            // Check if bid is forced to 0 for non-compliant leads
            if (result.bid === 0) {
              console.log(`${Colors.GREEN}✓ PASS: Bid correctly set to 0 for non-compliant lead${Colors.RESET}`);
            } else {
              console.log(`${Colors.RED}✗ FAIL: Bid should be 0 for non-compliant lead${Colors.RESET}`);
            }
          }
        } else {
          console.log(`${Colors.RED}✗ FAIL: ${type} lead incorrectly accepted${Colors.RESET}`);
          console.log('Result:', result);
        }
      }
    } catch (error) {
      console.error(`${Colors.RED}ERROR submitting ${type} lead:${Colors.RESET}`, error.message);
    }
  }
}

/**
 * Run all tests in sequence
 */
async function runAllTests() {
  console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}  STARTING END-TO-END COMPLIANCE SYSTEM TESTS  ${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
  
  try {
    // First test the compliance checker API directly
    await testComplianceChecker();
    
    // Then test DNC functionality
    await testDNCFunctionality();
    
    // Finally test lead submission with compliance checking
    await testLeadSubmission();
    
    console.log(`\n${Colors.MAGENTA}===============================================${Colors.RESET}`);
    console.log(`${Colors.MAGENTA}            ALL TESTS COMPLETED                ${Colors.RESET}`);
    console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
  } catch (error) {
    console.error(`${Colors.RED}ERROR running tests:${Colors.RESET}`, error);
  }
}

// Run the tests
runAllTests();
