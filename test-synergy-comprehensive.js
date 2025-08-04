// Comprehensive test for Synergy DNC checker with user-specified test numbers
console.log('🧪 COMPREHENSIVE SYNERGY DNC CHECKER TEST');
console.log('=========================================');

// Test numbers provided by user
const testCases = [
  // Should pass (compliant/clean)
  { phone: '6507769592', shouldPass: true, description: 'Should PASS (compliant)' },
  { phone: '4083109269', shouldPass: true, description: 'Should PASS (compliant)' },
  
  // Should not pass (non-compliant/on DNC)
  { phone: '1234567890', shouldPass: false, description: 'Should FAIL (non-compliant)' },
  { phone: '9412582821', shouldPass: false, description: 'Should FAIL (non-compliant)' },
];

async function testPhoneNumber(phone) {
  console.log(`📞 Testing: ${phone}`);
  console.log(`🔗 URL: https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/blacklist/check?phone_number=${phone}`);
  
  try {
    const url = `https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/blacklist/check?phone_number=${encodeURIComponent(phone)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Extract key compliance information
      const isCompliant = data.success === true && data.dnc === false;
      const isDNC = data.dnc === true;
      const reasons = data.reason || [];
      
      console.log(`📋 Response Summary:`);
      console.log(`   • Success: ${data.success}`);
      console.log(`   • DNC: ${data.dnc}`);
      console.log(`   • Reasons: ${JSON.stringify(reasons)}`);
      console.log(`   • Is Compliant: ${isCompliant}`);
      
      // Check individual service results
      if (data.meta_data && Array.isArray(data.meta_data)) {
        console.log(`🔍 Service Results:`);
        data.meta_data.forEach(service => {
          console.log(`   • ${service.service_name}: DNC=${service.dnc}`);
        });
      }
      
      return {
        phone,
        isCompliant,
        isDNC,
        reasons,
        fullResponse: data
      };
      
    } else {
      console.log(`❌ API Error: ${response.status}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      
      return {
        phone,
        isCompliant: false,
        isDNC: true,
        reasons: [`API Error: ${response.status}`],
        error: errorText
      };
    }
    
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return {
      phone,
      isCompliant: false,
      isDNC: true,
      reasons: [`Network Error: ${error.message}`],
      error: error.message
    };
  }
}

async function runComprehensiveTest() {
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📋 TEST ${i + 1}/4: ${testCase.phone}`);
    console.log(`📝 Expected: ${testCase.description}`);
    console.log(`${'='.repeat(50)}`);
    
    const result = await testCase.test();
    results.push({ ...testCase, result });
    
    // Add delay between requests to be respectful to API
    if (i < testCases.length - 1) {
      console.log(`⏳ Waiting 2 seconds before next test...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary report
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 TEST SUMMARY REPORT`);
  console.log(`${'='.repeat(70)}`);
  
  let passCount = 0;
  let failCount = 0;
  
  results.forEach((test, index) => {
    const expected = test.shouldPass ? 'PASS' : 'FAIL';
    const actual = test.result.isCompliant ? 'PASS' : 'FAIL';
    const correct = (expected === actual);
    
    console.log(`\n${index + 1}. ${test.phone}:`);
    console.log(`   Expected: ${expected} (${test.description})`);
    console.log(`   Actual:   ${actual} (compliant: ${test.result.isCompliant})`);
    console.log(`   Result:   ${correct ? '✅ CORRECT' : '❌ INCORRECT'}`);
    
    if (test.result.reasons.length > 0) {
      console.log(`   Reasons:  ${test.result.reasons.join(', ')}`);
    }
    
    if (correct) passCount++;
    else failCount++;
  });
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🎯 FINAL RESULTS:`);
  console.log(`   ✅ Correct: ${passCount}/${results.length}`);
  console.log(`   ❌ Incorrect: ${failCount}/${results.length}`);
  console.log(`   📈 Success Rate: ${Math.round((passCount/results.length) * 100)}%`);
  
  if (passCount === results.length) {
    console.log(`\n🎉 ALL TESTS PASSED! Synergy DNC checker is working correctly!`);
  } else {
    console.log(`\n⚠️  Some tests failed. The checker may need adjustment.`);
  }
  
  return results;
}

// Add the test function to each test case
testCases.forEach(testCase => {
  testCase.test = () => testPhoneNumber(testCase.phone);
});

// Run the comprehensive test
runComprehensiveTest().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
