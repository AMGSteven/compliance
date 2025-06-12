// Simplified lead posting test with proper error handling
const cleanNumber = '4083109269'; // Expected to pass compliance
const dirtyNumber = '1234567890'; // Expected to fail compliance (internal_dnc)

// API endpoint
const leadsApiUrl = 'http://localhost:3000/api/leads';
const apiKey = 'test_key_123';

// Utility function to post a lead
async function postLeadWithTimeout(phoneNumber, description) {
  console.log(`\nPosting lead with ${description} (${phoneNumber})...`);
  
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
  
  console.log(`Request payload:`, JSON.stringify(payload, null, 2));
  
  // Use native Node.js http request to handle timeout better
  return new Promise((resolve, reject) => {
    const http = require('http');
    
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000 // 10 second timeout
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            console.log(`Response data:`, JSON.stringify(parsedData, null, 2));
            resolve({ success: true, data: parsedData });
          } catch (e) {
            console.log(`Response (not JSON):`, data);
            resolve({ success: false, error: 'Invalid JSON response' });
          }
        } else {
          console.log(`Error response:`, data);
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Request error: ${error.message}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error('Request timed out after 10 seconds');
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    // Write data to request body
    req.write(postData);
    req.end();
  });
}

// Run tests one at a time
async function runTest() {
  console.log('===========================================');
  console.log('  SIMPLIFIED LEAD POSTING TEST  ');
  console.log('===========================================');
  
  try {
    console.log('\nTEST: POST CLEAN NUMBER');
    await postLeadWithTimeout(cleanNumber, 'clean number');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  console.log('\n===========================================');
  console.log('  TEST COMPLETE  ');
  console.log('===========================================');
}

runTest();
