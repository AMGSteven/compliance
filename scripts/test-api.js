/**
 * API testing script that doesn't rely on direct imports
 * Tests both dashboard stats and internal DNC checker APIs
 */

import fetch from 'node-fetch';
const PORT = 3001; // Using the port from our running server

// Set API key directly in environment for testing
process.env.DIALER_API_KEYS = 'test-api-key-123';
const API_KEY = 'test-api-key-123';

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m"
};

async function testDashboardStats() {
  console.log(`${colors.blue}${colors.bold}Testing Dashboard Stats API...${colors.reset}`);
  
  try {
    const response = await fetch(`http://localhost:${PORT}/api/dashboard-stats`);
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`${colors.green}✓ Dashboard API returned data successfully${colors.reset}`);
    console.log('  Data received:');
    Object.entries(data).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });
    
    return { success: true, data };
  } catch (error) {
    console.log(`${colors.red}✗ Dashboard API test failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testInternalDNCChecker() {
  console.log(`\n${colors.blue}${colors.bold}Testing Internal DNC Checker API...${colors.reset}`);
  
  const testPhoneNumber = '+18888888888';
  const testReason = 'Test via API test script';
  
  try {
    // Step 1: Add a number to the DNC list
    console.log(`  Adding test number ${testPhoneNumber} to DNC list...`);
    const addResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: testPhoneNumber,
        reason: testReason,
        source: 'test_script',
        added_by: 'api_test'
      })
    });
    
    if (!addResponse.ok) {
      throw new Error(`Add to DNC API returned status ${addResponse.status}`);
    }
    
    const addData = await addResponse.json();
    console.log(`${colors.green}✓ Number added to DNC list successfully${colors.reset}`);
    
    // Step 2: Check if the number is on the DNC list
    console.log('  Checking if number is on DNC list...');
    const checkResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: testPhoneNumber
      })
    });
    
    if (!checkResponse.ok) {
      throw new Error(`Check DNC API returned status ${checkResponse.status}`);
    }
    
    const checkData = await checkResponse.json();
    
    if (!checkData.isCompliant) {
      console.log(`${colors.green}✓ DNC check working correctly - number found on DNC list${colors.reset}`);
      console.log(`  Non-compliance reason: ${checkData.reasons ? checkData.reasons.join(', ') : 'Not specified'}`);
    } else {
      console.log(`${colors.red}✗ DNC check failed - number should be on DNC list but was reported as compliant${colors.reset}`);
    }
    
    // Step 3: Clean up - Remove test entry
    console.log('  Cleaning up test data...');
    const deleteResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: testPhoneNumber
      })
    });
    
    if (!deleteResponse.ok) {
      console.log(`${colors.yellow}! Warning: Could not clean up test data. Status: ${deleteResponse.status}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Test data cleaned up successfully${colors.reset}`);
    }
    
    return { success: !checkData.isCompliant, data: checkData };
  } catch (error) {
    console.log(`${colors.red}✗ Internal DNC Checker test failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testBulkDNCCheck() {
  console.log(`\n${colors.blue}${colors.bold}Testing Bulk DNC Check API...${colors.reset}`);
  
  const testNumbers = [
    '+18888888888',
    '+19999999999',
    '+17777777777'
  ];
  
  try {
    // First add one number to DNC
    console.log(`  Adding test number ${testNumbers[0]} to DNC list...`);
    const addResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: testNumbers[0],
        reason: 'Bulk test',
        source: 'test_script',
        added_by: 'api_test'
      })
    });
    
    if (!addResponse.ok) {
      throw new Error(`Add to DNC API returned status ${addResponse.status}`);
    }
    
    // Test bulk check
    console.log('  Testing bulk check with multiple numbers...');
    const bulkResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc/bulk/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_numbers: testNumbers
      })
    });
    
    if (!bulkResponse.ok) {
      throw new Error(`Bulk check API returned status ${bulkResponse.status}`);
    }
    
    const bulkData = await bulkResponse.json();
    console.log(`${colors.green}✓ Bulk DNC check returned results${colors.reset}`);
    
    let foundDNCNumber = false;
    console.log('  Results:');
    Object.entries(bulkData.results).forEach(([number, result]) => {
      const status = result.isCompliant ? 'Compliant' : 'Non-Compliant';
      console.log(`    ${number}: ${status}`);
      if (number === testNumbers[0] && !result.isCompliant) {
        foundDNCNumber = true;
      }
    });
    
    if (foundDNCNumber) {
      console.log(`${colors.green}✓ Bulk DNC check correctly identified DNC number${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Bulk DNC check failed to identify DNC number${colors.reset}`);
    }
    
    // Clean up
    console.log('  Cleaning up test data...');
    const deleteResponse = await fetch(`http://localhost:${PORT}/api/dialer/dnc`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        phone_number: testNumbers[0]
      })
    });
    
    if (!deleteResponse.ok) {
      console.log(`${colors.yellow}! Warning: Could not clean up test data. Status: ${deleteResponse.status}${colors.reset}`);
    }
    
    return { success: foundDNCNumber, data: bulkData };
  } catch (error) {
    console.log(`${colors.red}✗ Bulk DNC Check test failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log(`${colors.blue}${colors.bold}🧪 Running API Tests 🧪${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
  
  const dashboardResult = await testDashboardStats();
  const dncResult = await testInternalDNCChecker();
  let bulkResult = { success: false, error: 'Test not run' };
  
  // Only run bulk test if individual DNC test passed
  if (dncResult.success) {
    bulkResult = await testBulkDNCCheck();
  } else {
    console.log(`\n${colors.yellow}Skipping bulk DNC test because individual DNC test failed${colors.reset}`);
  }
  
  // Summary
  console.log(`\n${colors.blue}${colors.bold}📊 Test Summary${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}`);
  console.log(`Dashboard Stats: ${dashboardResult.success ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  console.log(`Internal DNC Checker: ${dncResult.success ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  console.log(`Bulk DNC Checker: ${bulkResult.success ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  
  if (!dashboardResult.success) {
    console.log(`${colors.red}Dashboard Stats Error: ${dashboardResult.error}${colors.reset}`);
  }
  
  if (!dncResult.success) {
    console.log(`${colors.red}Internal DNC Checker Error: ${dncResult.error}${colors.reset}`);
  }
  
  if (!bulkResult.success && bulkResult.error !== 'Test not run') {
    console.log(`${colors.red}Bulk DNC Checker Error: ${bulkResult.error}${colors.reset}`);
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
});
