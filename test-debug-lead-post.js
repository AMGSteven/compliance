// Test script for debugging lead posting issues
const cleanNumber = '4083109269'; // Expected to pass compliance
const dirtyNumber = '1234567890'; // Expected to fail compliance (internal_dnc)

// API endpoint for debugging
const debugApiUrl = 'http://localhost:3000/api/debug-lead-post';
const apiKey = 'test_key_123';

// Utility function to post a lead to the debug API
async function testLeadPost(phoneNumber, description) {
  console.log(`\nTesting lead post with ${description} (${phoneNumber})...`);
  
  try {
    const payload = {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: phoneNumber,
      state: "CA",
      zipCode: "90210",
      listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
      campaignId: "test-campaign",
      trustedFormCertUrl: "https://cert.trustedform.com/example",
      incomeBracket: "50000-75000",
      homeownerStatus: "owner",
      ageRange: "30-40"
    };
    
    console.log(`Request payload for ${description}:`, JSON.stringify(payload, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(debugApiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`Response status for ${description}: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Diagnostic results for ${description}:`, JSON.stringify(data, null, 2));
      
      // Check which components worked and which might be causing issues
      if (data.diagnostic) {
        console.log(`Total processing time: ${data.diagnostic.totalTimeMs}ms`);
        
        if (data.diagnostic.database) {
          console.log(`Database check: ${data.diagnostic.database.success ? 'SUCCESS' : 'FAILED'} (${data.diagnostic.database.timeMs}ms)`);
        }
        
        if (data.diagnostic.compliance) {
          console.log(`Compliance check: ${data.diagnostic.compliance.success ? 'SUCCESS' : 'FAILED'} (${data.diagnostic.compliance.timeMs}ms)`);
          
          if (data.diagnostic.compliance.result && data.diagnostic.compliance.result.results) {
            console.log('Compliance check results:');
            data.diagnostic.compliance.result.results.forEach(result => {
              console.log(`- ${result.source}: ${result.isCompliant ? 'Compliant' : 'Non-compliant'}`);
              if (!result.isCompliant && result.reasons) {
                console.log(`  Reasons: ${result.reasons.join(', ')}`);
              }
            });
          }
        }
        
        if (data.diagnostic.dialer) {
          console.log(`Dialer API check: ${data.diagnostic.dialer.success ? 'SUCCESS' : 'FAILED'} (${data.diagnostic.dialer.timeMs}ms)`);
        }
      }
    } else {
      console.log(`Error status ${response.status} for ${description}`);
      try {
        const errorData = await response.json();
        console.log(`Error details:`, JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log(`Could not parse error response: ${e.message}`);
      }
    }
  } catch (error) {
    console.error(`Error in debug test with ${description}:`, error);
    
    if (error.name === 'AbortError') {
      console.log(`Request for ${description} timed out after 30 seconds`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('===========================================');
  console.log('  LEAD POSTING DIAGNOSTIC TEST  ');
  console.log('===========================================');
  
  console.log('\nTEST 1: CLEAN NUMBER');
  await testLeadPost(cleanNumber, 'clean number');
  
  console.log('\nTEST 2: DIRTY NUMBER');
  await testLeadPost(dirtyNumber, 'dirty number');
  
  console.log('\n===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTests();
