// Simple test script for TCPA compliance service

import { createDefaultTCPAComplianceChecker } from './lib/services/tcpa-compliance-service.js';

async function runTest() {
  console.log('Starting TCPA compliance service test...');
  
  try {
    // Create the checker instance
    const tcpaChecker = createDefaultTCPAComplianceChecker();
    console.log('TCPA checker instance created');
    
    // Test single phone check
    console.log('\nTesting single phone check...');
    const singleResult = await tcpaChecker.checkPhone('5551234567');
    console.log('Single check result:', JSON.stringify(singleResult, null, 2));
    
    // Test batch phone check
    console.log('\nTesting batch phone check...');
    const batchResults = await tcpaChecker.checkPhones([
      { phone: '5551234567', name: 'Test User 1' },
      { phone: '5559876543', name: 'Test User 2' },
      { phone: 'invalid-number', name: 'Invalid Number Test' } // This should be filtered out
    ]);
    console.log('Batch check summary:');
    console.log(`- Total checked: ${batchResults.totalChecked}`);
    console.log(`- Compliant: ${batchResults.compliantCount}`);
    console.log(`- Non-compliant: ${batchResults.nonCompliantCount}`);
    console.log(`- Has errors: ${batchResults.hasErrors}`);
    console.log(`- Batch ID: ${batchResults.batchId}`);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

runTest();
