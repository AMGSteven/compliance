#!/usr/bin/env node

/**
 * Test script to verify we get 401 with invalid API key
 * This confirms we're hitting the right endpoints
 */

import { Buffer } from 'buffer';

async function testInvalidAuth() {
  console.log('Testing TrustedForm API with invalid credentials...');
  
  const invalidApiKey = 'invalid_test_key_123';
  const certificateId = 'c9c848b2eea97eca5bf90a8a76b422ab283d082c';
  
  try {
    console.log('\n=== Testing with Invalid API Key ===');
    console.log('Certificate ID:', certificateId);
    console.log('Invalid API Key:', invalidApiKey);
    
    const response = await fetch(`https://api.trustedform.com/v4/certificates/${certificateId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from('API:' + invalidApiKey).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    if (response.status === 401) {
      console.log('✅ Got 401 Unauthorized - API endpoint is correct, auth is working');
    } else if (response.status === 404) {
      console.log('⚠️  Still getting 404 - might indicate endpoint or certificate issues');
    } else {
      console.log('🤔 Unexpected status code:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvalidAuth();
