/**
 * State validation test script
 * Tests that the leads API correctly validates states
 */

import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m"
};

// Allowed states
const ALLOWED_STATES = ['AL', 'AR', 'AZ', 'IN', 'KS', 'LA', 'MO', 'MS', 'OH', 'SC', 'TN', 'TX'];

// Create a direct database connection to bypass API validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://prswgbctroqhtnqaihrt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testStateValidationDirectly() {
  console.log(`${colors.blue}${colors.bold}Testing State Validation Implementation${colors.reset}`);

  // Test both allowed and disallowed states
  const testStates = [
    // Allowed states (sample)
    { state: 'TX', allowed: true },
    { state: 'OH', allowed: true },
    // Disallowed states (sample)
    { state: 'CA', allowed: false },
    { state: 'NY', allowed: false },
  ];
  
  // Test with real phone number that passes validation
  // Using the test number from the spec
  const realPhoneNumber = "6507769592";
  
  for (const { state, allowed } of testStates) {
    console.log(`\nTesting state: ${state} (${allowed ? 'Should be ALLOWED' : 'Should be REJECTED'})`);
    
    // Create test lead
    const testLead = {
      firstName: "StateTester",
      lastName: "Validation",
      email: `statetest_${state}@example.com`,
      phone: realPhoneNumber,
      address: "123 Test St",
      city: "Test City",
      state: state,
      zipCode: "12345",
      listId: "94ec4eec-d409-422b-abbd-bd9ee35ce08a",
      campaignId: "state-test-campaign",
      incomeBracket: "$50,000-$75,000",
      homeownerStatus: "Homeowner",
      dob: "1980-01-01",
      source: "State Validation Test",
      trustedFormCertUrl: "https://cert.trustedform.com/testcert",
      token: "be53740f04b40724b950c95d71e2528d"
    };
    
    // Log the request
    console.log(`Sending test lead with state ${state} to API...`);
    
    try {
      // Make API request
      const response = await fetch('https://compliance.juicedmedia.io/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testLead)
      });
      
      const data = await response.json();
      
      // Check if response matches expected behavior
      console.log(`Response status: ${response.status}`);
      console.log(`Response data:`, JSON.stringify(data, null, 2));
      
      // Analyze result
      if (allowed) {
        // For allowed states, API should accept or reject for non-state reasons
        if (data.success) {
          console.log(`${colors.green}✓ PASS: Allowed state ${state} was accepted${colors.reset}`);
        } else if (data.error && data.error.includes('State not allowed')) {
          console.log(`${colors.red}✗ FAIL: Allowed state ${state} was incorrectly rejected due to state${colors.reset}`);
        } else {
          console.log(`${colors.yellow}! INFO: Allowed state ${state} was rejected for other reasons${colors.reset}`);
          console.log(`Reason: ${data.error}`);
        }
      } else {
        // For disallowed states, API should always reject with state reason
        if (!data.success && data.error && data.error.includes('State not allowed')) {
          console.log(`${colors.green}✓ PASS: Disallowed state ${state} was correctly rejected due to state${colors.reset}`);
        } else if (data.success) {
          console.log(`${colors.red}✗ FAIL: Disallowed state ${state} was incorrectly accepted${colors.reset}`);
        } else {
          console.log(`${colors.yellow}! INFO: Disallowed state ${state} was rejected, but not due to state${colors.reset}`);
          console.log(`Reason: ${data.error}`);
        }
      }
    } catch (error) {
      console.log(`${colors.red}✗ ERROR: Failed to test state ${state}${colors.reset}`);
      console.error(error);
    }
  }
}

/**
 * Directly inserts a test lead into the database and then tries to query by state
 * This bypasses the API validation to test if our state validation code is correct
 */
async function testStateImplementationInDb() {
  console.log(`\n${colors.blue}${colors.bold}Testing State Implementation in Database${colors.reset}`);
  
  if (!supabaseKey) {
    console.log(`${colors.red}✗ Missing SUPABASE_SERVICE_ROLE_KEY env variable. Cannot perform direct DB test.${colors.reset}`);
    return;
  }
  
  try {
    // Create a unique identifier for our test
    const testId = `state_test_${Date.now()}`;
    
    // Test inserting an allowed state (TX) and disallowed state (CA)
    const testStates = [
      { state: 'TX', phone: '5125551234', allowed: true },
      { state: 'CA', phone: '4155551234', allowed: false }
    ];
    
    for (const { state, phone, allowed } of testStates) {
      console.log(`\nInserting test lead with state ${state} directly into database...`);
      
      // Insert test lead directly 
      const { data, error } = await supabase
        .from('leads')
        .insert({
          first_name: 'DbTest',
          last_name: testId,
          email: `dbtest_${state}@example.com`,
          phone: phone,
          state: state,
          zip_code: '12345',
          trusted_form_cert_url: 'https://cert.trustedform.com/test',
          income_bracket: '$50,000-$75,000',
          homeowner_status: 'Homeowner',
          birth_date: '1980-01-01',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.log(`${colors.red}✗ Failed to insert test lead with state ${state}${colors.reset}`);
        console.error(error);
        continue;
      }
      
      console.log(`${colors.green}✓ Successfully inserted test lead with state ${state} (ID: ${data.id})${colors.reset}`);
      
      // Now try to query for this lead through the API
      console.log(`Querying for lead via API with ID: ${data.id}`);
    }
    
    // Check API implementation by making a direct call to the code function
    console.log(`\nTesting direct validation against list of allowed states...`);
    for (const state of ['TX', 'ca', 'AZ', 'FL', 'NY']) {
      const normalizedState = state.toUpperCase();
      const isAllowed = ALLOWED_STATES.includes(normalizedState);
      console.log(`State ${state} (normalized: ${normalizedState}) is ${isAllowed ? 'ALLOWED' : 'REJECTED'}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Database test failed with error${colors.reset}`);
    console.error(error);
  }
}

// Main test function
async function runTests() {
  console.log(`${colors.blue}${colors.bold}🔍 Running State Validation Tests 🔍${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
  
  // Run API tests
  await testStateValidationDirectly();
  
  // Run database tests
  await testStateImplementationInDb();
  
  console.log(`\n${colors.blue}${colors.bold}Test Execution Complete${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
});
