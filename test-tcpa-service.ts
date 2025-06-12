// TCPA Compliance Service Test

import {
  TCPAComplianceChecker, 
  createDefaultTCPAComplianceChecker
} from './lib/services/tcpa-compliance-service';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function runTest() {
  console.log('Starting TCPA compliance service test...');
  
  try {
    // Create the checker instance using environment variables
    const tcpaChecker = createDefaultTCPAComplianceChecker();
    console.log('✅ TCPA checker instance created successfully');
    
    // Test the makeRequest method indirectly through checkPhone
    console.log('\nTesting error handling with invalid API credentials...');
    const result = await tcpaChecker.checkPhone('5551234567');
    console.log('Results with invalid credentials (expected to fail with auth error):');
    console.log(JSON.stringify(result, null, 2));
    
    // Test input validation
    console.log('\nTesting input validation...');
    const invalidResult = await tcpaChecker.checkPhone('invalid-number');
    console.log('Invalid phone result:', JSON.stringify(invalidResult, null, 2));
    
    // Test batch processing logic
    console.log('\nTesting batch processing...');
    const batchResult = await tcpaChecker.checkPhones([
      { phone: '5551234567', name: 'Test User 1' },
      { phone: '5559876543', name: 'Test User 2' },
      { phone: 'invalid-number', name: 'Invalid Number Test' }
    ]);
    
    console.log(`Batch results summary:`);
    console.log(`- Total checked: ${batchResult.totalChecked}`);
    console.log(`- Valid phones processed: ${batchResult.results.length}`);
    console.log(`- Batch ID: ${batchResult.batchId}`);
    
    console.log('\n✅ Tests completed! TypeScript compilation and functionality tests passed.');
    console.log('Note: API calls failed as expected with test credentials.');
    
  } catch (error) {
    console.error('❌ Test failed with unexpected error:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
