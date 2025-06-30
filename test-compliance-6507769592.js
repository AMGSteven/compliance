// Test compliance engine with 6507769592
import fetch from 'node-fetch';

async function testComplianceWith6507769592() {
  const testNumber = '6507769592';
  const baseUrl = 'http://localhost:3000';
  
  console.log(`=== Testing Compliance Engine with ${testNumber} ===`);
  
  try {
    const response = await fetch(`${baseUrl}/api/compliance/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: testNumber
      })
    });

    const result = await response.json();
    
    console.log(`\n📱 Phone Number: ${testNumber}`);
    console.log(`✅ Overall Compliant: ${result.isCompliant}`);
    console.log(`📅 Timestamp: ${result.timestamp}`);
    
    if (result.results && result.results.length > 0) {
      console.log('\n🔍 Individual Checker Results:');
      result.results.forEach(checker => {
        console.log(`\n📋 ${checker.source}:`);
        console.log(`  ✅ Compliant: ${checker.isCompliant}`);
        if (checker.reasons && checker.reasons.length > 0) {
          console.log(`  📝 Reasons: ${checker.reasons.join(', ')}`);
        }
        if (checker.details && Object.keys(checker.details).length > 0) {
          console.log(`  🔍 Details: ${JSON.stringify(checker.details, null, 4)}`);
        }
      });
      
      // Focus on Webrecon specifically
      const webreconResult = result.results.find(r => r.source === 'Webrecon');
      if (webreconResult) {
        console.log('\n🎯 WEBRECON SPECIFIC RESULT:');
        console.log(`  Phone: ${testNumber}`);
        console.log(`  Status: ${webreconResult.isCompliant ? '✅ CLEAN' : '❌ FLAGGED'}`);
        if (webreconResult.reasons.length > 0) {
          console.log(`  Reasons: ${webreconResult.reasons.join(', ')}`);
        }
        console.log(`  Details: ${JSON.stringify(webreconResult.details, null, 2)}`);
      } else {
        console.log('\n⚠️  Webrecon checker not found in results');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing compliance:', error.message);
  }
}

testComplianceWith6507769592().catch(console.error);
