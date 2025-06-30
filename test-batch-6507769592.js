// Test batch compliance with 6507769592
import fetch from 'node-fetch';

async function testBatchComplianceWith6507769592() {
  const testNumber = '6507769592';
  const baseUrl = 'http://localhost:3000';
  
  console.log(`=== Testing Batch Compliance with ${testNumber} ===`);
  
  // Create a CSV with just the test number
  const csvData = `phone\n${testNumber}`;
  
  try {
    const response = await fetch(`${baseUrl}/api/compliance/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
      },
      body: csvData
    });

    const result = await response.text();
    
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`\n📋 Response Body:`);
    console.log(result);
    
    // Try to parse as JSON if it looks like JSON
    if (result.trim().startsWith('{') || result.trim().startsWith('[')) {
      try {
        const jsonResult = JSON.parse(result);
        console.log('\n🔍 Parsed JSON:');
        console.log(JSON.stringify(jsonResult, null, 2));
        
        // Look for compliance results
        if (jsonResult.results && jsonResult.results.length > 0) {
          const phoneResult = jsonResult.results.find(r => r.phone === testNumber);
          if (phoneResult) {
            console.log(`\n🎯 Result for ${testNumber}:`);
            console.log(`  Overall Compliant: ${phoneResult.isCompliant}`);
            if (phoneResult.checks) {
              console.log(`  Internal DNC: ${phoneResult.checks.internalDNC}`);
              console.log(`  Synergy DNC: ${phoneResult.checks.synergyDNC}`);
            }
            if (phoneResult.failureReasons && phoneResult.failureReasons.length > 0) {
              console.log(`  Failure Reasons: ${phoneResult.failureReasons.join(', ')}`);
            }
          }
        }
      } catch (parseError) {
        console.log('⚠️  Could not parse as JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing batch compliance:', error.message);
  }
}

testBatchComplianceWith6507769592().catch(console.error);
