// Test script for compliance check with only API key
import fetch from 'node-fetch';

async function testComplianceCheck() {
  const baseUrl = 'http://localhost:3000';
  const testNumber = '1234567890';
  
  try {
    // Test the main compliance check endpoint
    console.log('Testing compliance check endpoint with API key only...');
    const complianceRes = await fetch(`${baseUrl}/api/check-compliance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify({
        phoneNumber: testNumber
      })
    });
    
    console.log('Compliance check status:', complianceRes.status);
    
    try {
      const responseText = await complianceRes.text();
      // Try to parse as JSON if possible
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('Compliance check response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        // Not JSON, just log the text
        console.log('Response text (first 500 chars):', responseText.substring(0, 500));
      }
    } catch (e) {
      console.log('Error reading response:', e);
    }
    
    // Test the V1 compliance check endpoint
    console.log('\nTesting V1 compliance check endpoint with API key only...');
    const v1ComplianceRes = await fetch(`${baseUrl}/api/v1/compliance/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify({
        phone: testNumber,
        contactName: 'Test User'
      })
    });
    
    console.log('V1 Compliance check status:', v1ComplianceRes.status);
    
    try {
      const responseText = await v1ComplianceRes.text();
      // Try to parse as JSON if possible
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('V1 Compliance check response:', JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        // Not JSON, just log the text
        console.log('Response text (first 500 chars):', responseText.substring(0, 500));
      }
    } catch (e) {
      console.log('Error reading response:', e);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testComplianceCheck();
