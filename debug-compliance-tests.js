/**
 * Targeted Tests for Compliance System Issues
 * 
 * This script focuses on:
 * 1. Testing the direct compliance checker API endpoint
 * 2. Testing the DNC API with different parameter formats
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:3003';
const API_KEY = 'test_key_123';
const VALID_PHONE = '6507769592'; // Valid number that should pass all checks

// Test colors for visibility
const Colors = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
};

/**
 * Test the standard compliance checker API endpoint
 */
async function testComplianceCheckerEndpoint() {
  console.log(`${Colors.MAGENTA}======== Testing Compliance Checker API ========${Colors.RESET}`);
  
  // Test all endpoints that check compliance
  const endpoints = [
    { path: '/api/check-compliance', description: 'Standard compliance endpoint' },
    { path: '/api/v1/compliance/check', description: 'V1 compliance endpoint' },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n${Colors.BLUE}Testing ${endpoint.description}:${Colors.RESET}`);
    
    try {
      // First try with a known valid number
      console.log(`${Colors.YELLOW}With valid phone: ${VALID_PHONE}${Colors.RESET}`);
      const validResponse = await fetch(`${BASE_URL}${endpoint.path}?phone=${VALID_PHONE}`, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status code: ${validResponse.status}`);
      
      if (validResponse.ok) {
        const validResult = await validResponse.json();
        console.log('Response:', JSON.stringify(validResult, null, 2));
        
        if (validResult.isCompliant === true) {
          console.log(`${Colors.GREEN}✓ PASS: Valid number correctly identified as compliant${Colors.RESET}`);
        } else {
          console.log(`${Colors.RED}✗ FAIL: Valid number incorrectly rejected${Colors.RESET}`);
        }
        
        // Check if all 6 services ran
        if (validResult.results && Array.isArray(validResult.results)) {
          const services = validResult.results.map(r => r.source);
          console.log('Services checked:', services.join(', '));
          console.log(`Number of services: ${services.length}/6`);
        }
      } else {
        console.log(`${Colors.RED}Error: Non-OK response from server${Colors.RESET}`);
        try {
          const errorText = await validResponse.text();
          console.log('Error response:', errorText.slice(0, 200) + '...');
        } catch (e) {
          console.log('Could not read response text');
        }
      }
      
      // Now try with an invalid number
      console.log(`\n${Colors.YELLOW}With invalid phone: 9999999999${Colors.RESET}`);
      const invalidResponse = await fetch(`${BASE_URL}${endpoint.path}?phone=9999999999`, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status code: ${invalidResponse.status}`);
      
      if (invalidResponse.ok) {
        const invalidResult = await invalidResponse.json();
        console.log('Response:', JSON.stringify(invalidResult, null, 2));
        
        if (invalidResult.isCompliant === false) {
          console.log(`${Colors.GREEN}✓ PASS: Invalid number correctly rejected${Colors.RESET}`);
        } else {
          console.log(`${Colors.RED}✗ FAIL: Invalid number incorrectly accepted${Colors.RESET}`);
        }
        
        // Check for phone validation
        if (invalidResult.results) {
          const phoneValidation = invalidResult.results.find(r => r.source === 'Phone Validation');
          if (phoneValidation) {
            console.log(`${Colors.GREEN}✓ Phone Validation service ran${Colors.RESET}`);
          } else {
            console.log(`${Colors.RED}✗ Phone Validation service not found${Colors.RESET}`);
          }
        }
      } else {
        console.log(`${Colors.RED}Error: Non-OK response from server${Colors.RESET}`);
        try {
          const errorText = await invalidResponse.text();
          console.log('Error response:', errorText.slice(0, 200) + '...');
        } catch (e) {
          console.log('Could not read response text');
        }
      }
    } catch (error) {
      console.error(`${Colors.RED}ERROR testing ${endpoint.description}:${Colors.RESET}`, error.message);
    }
  }
}

/**
 * Test DNC API with different parameter formats
 */
async function testDNCAPIParameters() {
  console.log(`\n${Colors.MAGENTA}======== Testing DNC API Parameter Formats ========${Colors.RESET}`);
  
  const phoneNumber = '5551234567';
  
  // Test different parameter formats for the DNC API
  const paramFormats = [
    { description: 'Using "phone" parameter', body: { phone: phoneNumber, reason: 'Test DNC' } },
    { description: 'Using "phoneNumber" parameter', body: { phoneNumber: phoneNumber, reason: 'Test DNC' } },
    { description: 'Using both parameters', body: { phone: phoneNumber, phoneNumber: phoneNumber, reason: 'Test DNC' } }
  ];
  
  for (const format of paramFormats) {
    console.log(`\n${Colors.BLUE}${format.description}:${Colors.RESET}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/dialer/dnc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(format.body)
      });
      
      console.log(`Status code: ${response.status}`);
      
      const result = await response.json();
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (response.ok && result.success) {
        console.log(`${Colors.GREEN}✓ PASS: Successfully added number to DNC${Colors.RESET}`);
        console.log('DNC Entry ID:', result.id);
        
        // Now verify by checking compliance
        const complianceResponse = await fetch(`${BASE_URL}/api/check-compliance?phone=${phoneNumber}`, {
          method: 'GET',
          headers: {
            'X-API-Key': API_KEY,
            'Accept': 'application/json'
          }
        });
        
        if (complianceResponse.ok) {
          const complianceResult = await complianceResponse.json();
          
          // Check if Internal DNC rejected the number
          const dncCheck = complianceResult.results?.find(r => r.source === 'Internal DNC');
          if (dncCheck && !dncCheck.compliant) {
            console.log(`${Colors.GREEN}✓ PASS: Number was correctly rejected by Internal DNC${Colors.RESET}`);
          } else {
            console.log(`${Colors.RED}✗ FAIL: Number was not rejected by Internal DNC${Colors.RESET}`);
          }
        }
      } else {
        console.log(`${Colors.RED}✗ FAIL: Could not add number to DNC${Colors.RESET}`);
      }
    } catch (error) {
      console.error(`${Colors.RED}ERROR testing ${format.description}:${Colors.RESET}`, error.message);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}     DEBUGGING COMPLIANCE SYSTEM ISSUES       ${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
  
  // First test the compliance checker API endpoint
  await testComplianceCheckerEndpoint();
  
  // Then test the DNC API parameter formats
  await testDNCAPIParameters();
  
  console.log(`\n${Colors.MAGENTA}===============================================${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}               TESTS COMPLETED                ${Colors.RESET}`);
  console.log(`${Colors.MAGENTA}===============================================${Colors.RESET}`);
}

// Run the tests
runTests();
