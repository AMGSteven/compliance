// Test script to verify that all API endpoints can be accessed with just the API key
import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';
const apiKey = 'test_key_123';

// List of endpoints to test
const endpoints = [
  // DNC endpoints
  { 
    url: '/api/dialer/dnc', 
    method: 'POST',
    body: { phone_number: '1234567890', reason: 'Test', source: 'test' }
  },
  { 
    url: '/api/dialer/dnc?phone=1234567890&api_key=test_key_123', 
    method: 'GET' 
  },
  
  // Compliance check endpoints
  { 
    url: '/api/check-compliance', 
    method: 'POST',
    body: { phoneNumber: '1234567890' }
  },
  { 
    url: '/api/v1/compliance/check', 
    method: 'POST',
    body: { phone: '1234567890' }
  },
  
  // Dashboard stats endpoints
  { 
    url: '/api/dashboard-stats', 
    method: 'GET' 
  },
  
  // Leads endpoints
  { 
    url: '/api/leads/list', 
    method: 'GET' 
  },
  
  // TrustedForm endpoints
  { 
    url: '/api/trusted-form/records', 
    method: 'GET' 
  },
  
  // V1 API endpoints
  { 
    url: '/api/v1/dashboard-stats', 
    method: 'GET' 
  },
  { 
    url: '/api/v1/leads', 
    method: 'GET' 
  }
];

async function testEndpoint(endpoint) {
  console.log(`Testing ${endpoint.method} ${endpoint.url}...`);
  
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    };
    
    if (endpoint.body && endpoint.method !== 'GET') {
      options.body = JSON.stringify(endpoint.body);
    }
    
    const response = await fetch(`${baseUrl}${endpoint.url}`, options);
    
    console.log(`  Status: ${response.status}`);
    
    // Check if we got redirected to login
    const wasRedirected = response.url.includes('/login');
    console.log(`  Redirected to login: ${wasRedirected}`);
    
    if (wasRedirected) {
      console.log('  ❌ FAILED - Authentication still required');
    } else {
      console.log('  ✅ SUCCESS - No authentication required');
    }
    
    // Try to get the response content
    try {
      const text = await response.text();
      try {
        // Try to parse as JSON
        const json = JSON.parse(text);
        console.log(`  Response: ${JSON.stringify(json).substring(0, 100)}${JSON.stringify(json).length > 100 ? '...' : ''}`);
      } catch (e) {
        // Not JSON, just show beginning of text
        console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      }
    } catch (e) {
      console.log(`  Error reading response: ${e.message}`);
    }
    
    console.log(''); // Add an empty line for readability
    
    return !wasRedirected;
  } catch (error) {
    console.error(`  Error testing endpoint: ${error.message}`);
    console.log(''); // Add an empty line for readability
    return false;
  }
}

async function runTests() {
  console.log('=== Testing API Endpoints with API Key Only ===\n');
  
  let successes = 0;
  let failures = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) {
      successes++;
    } else {
      failures++;
    }
  }
  
  console.log('=== Test Summary ===');
  console.log(`Total endpoints tested: ${endpoints.length}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures: ${failures}`);
  
  if (failures === 0) {
    console.log('\n✅ ALL TESTS PASSED - All API endpoints can be accessed with just the API key!');
  } else {
    console.log(`\n❌ ${failures} TEST(S) FAILED - Some API endpoints still require authentication`);
  }
}

// Run the tests
runTests();
