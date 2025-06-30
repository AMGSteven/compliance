import https from 'https';

// Test state validation for different dialer types
const testCases = [
  {
    name: 'FL state with Pitch BPO routing (should be allowed)',
    payload: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.com',
      phone: '6507769592', // bypass number
      state: 'FL',
      zipCode: '12345',
      leadSource: 'TestAPI',
      routingData: {
        dialer_type: 2 // Pitch BPO
      }
    },
    expectSuccess: true
  },
  {
    name: 'FL state with Internal Dialer routing (should be rejected)',
    payload: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.com',
      phone: '6507769592', // bypass number
      state: 'FL',
      zipCode: '12345',
      leadSource: 'TestAPI',
      routingData: {
        dialer_type: 1 // Internal Dialer
      }
    },
    expectSuccess: false
  },
  {
    name: 'FL state with no routing data (defaults to Internal Dialer - should be rejected)',
    payload: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.com',
      phone: '6507769592', // bypass number
      state: 'FL',
      zipCode: '12345',
      leadSource: 'TestAPI'
    },
    expectSuccess: false
  },
  {
    name: 'TX state with Internal Dialer (should be allowed)',
    payload: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@test.com',
      phone: '6507769592', // bypass number
      state: 'TX',
      zipCode: '12345',
      leadSource: 'TestAPI',
      routingData: {
        dialer_type: 1 // Internal Dialer
      }
    },
    expectSuccess: true
  },
  {
    name: 'MI state with Pitch BPO routing (should be allowed)',
    payload: {
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@test.com',
      phone: '6507769592', // bypass number
      state: 'MI',
      zipCode: '12345',
      leadSource: 'TestAPI',
      routingData: {
        dialer_type: 2 // Pitch BPO
      }
    },
    expectSuccess: true
  },
  {
    name: 'OK state with Internal Dialer (should be rejected)',
    payload: {
      firstName: 'Alice',
      lastName: 'Williams',
      email: 'alice.williams@test.com',
      phone: '6507769592', // bypass number
      state: 'OK',
      zipCode: '12345',
      leadSource: 'TestAPI',
      routingData: {
        dialer_type: 1 // Internal Dialer
      }
    },
    expectSuccess: false
  }
];

async function testStateValidation(testCase) {
  return new Promise((resolve) => {
    const data = JSON.stringify(testCase.payload);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      // Allow self-signed certificates for local testing
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          const success = response.success === true;
          const passed = success === testCase.expectSuccess;
          
          console.log(`\n${testCase.name}:`);
          console.log(`  Expected: ${testCase.expectSuccess ? 'SUCCESS' : 'FAILURE'}`);
          console.log(`  Got: ${success ? 'SUCCESS' : 'FAILURE'}`);
          console.log(`  Test: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
          
          if (!passed) {
            console.log(`  Response: ${JSON.stringify(response, null, 2)}`);
          }
          
          resolve({ passed, testCase: testCase.name });
        } catch (error) {
          console.log(`\n${testCase.name}:`);
          console.log(`  ❌ FAILED - Invalid JSON response`);
          console.log(`  Error: ${error.message}`);
          console.log(`  Response: ${body}`);
          resolve({ passed: false, testCase: testCase.name });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`\n${testCase.name}:`);
      console.log(`  ❌ FAILED - Request error: ${error.message}`);
      resolve({ passed: false, testCase: testCase.name });
    });

    req.write(data);
    req.end();
  });
}

async function runAllTests() {
  console.log('🧪 Testing State Validation for Different Dialer Types');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testStateValidation(testCase);
    results.push(result);
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! State validation is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testCase}`);
    });
  }
}

runAllTests().catch(console.error);
