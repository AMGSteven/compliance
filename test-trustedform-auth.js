#!/usr/bin/env node

/**
 * Test script to verify TrustedForm API authentication
 * Tests API key validity and basic connectivity
 */

import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.TRUSTED_FORM_API_KEY;

async function testTrustedFormAuth() {
  try {
    if (!API_KEY) {
      throw new Error('TRUSTED_FORM_API_KEY not found in environment variables');
    }

    console.log('Testing TrustedForm API Authentication...');
    console.log('API Key present:', !!API_KEY);
    console.log('API Key prefix:', API_KEY.substring(0, 8) + '...');

    // Test 1: Try to access the API root or a general endpoint
    console.log('\n=== Test 1: API Root Access ===');
    try {
      const rootResponse = await fetch('https://api.trustedform.com/v4/', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Root API response status:', rootResponse.status);
      const rootText = await rootResponse.text();
      console.log('Root API response:', rootText.substring(0, 200));
      
      if (rootResponse.status === 401) {
        console.log('❌ Authentication failed - Invalid API key');
        return;
      } else if (rootResponse.status === 200) {
        console.log('✅ Authentication successful');
      }
    } catch (error) {
      console.log('Root API test failed:', error.message);
    }

    // Test 2: Try a certificates listing endpoint (if available)
    console.log('\n=== Test 2: Certificates Endpoint ===');
    try {
      const certsResponse = await fetch('https://api.trustedform.com/v4/certificates', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Certificates API response status:', certsResponse.status);
      const certsText = await certsResponse.text();
      console.log('Certificates API response:', certsText.substring(0, 300));
      
      if (certsResponse.status === 401) {
        console.log('❌ Authentication failed for certificates endpoint');
      } else if (certsResponse.status === 200) {
        console.log('✅ Successfully accessed certificates endpoint');
        
        // Try to parse and show available certificates
        try {
          const certsData = JSON.parse(certsText);
          if (certsData.certificates && certsData.certificates.length > 0) {
            console.log('\n📋 Available certificates:');
            certsData.certificates.slice(0, 3).forEach((cert, index) => {
              console.log(`${index + 1}. ID: ${cert.id || 'N/A'}, Created: ${cert.created_at || 'N/A'}`);
            });
          }
        } catch (parseError) {
          console.log('Could not parse certificates response as JSON');
        }
      }
    } catch (error) {
      console.log('Certificates API test failed:', error.message);
    }

    // Test 3: Generate some test certificate IDs to try
    console.log('\n=== Test 3: Common Certificate ID Patterns ===');
    const testCertIds = [
      'c9c848b2eea97eca5bf90a8a76b422ab283d082c', // User provided
      '9c96ea7d123552314e72837ee6a1a324272b0951', // Previous test
      'test',
      'example'
    ];

    for (const testId of testCertIds) {
      try {
        console.log(`\nTesting certificate ID: ${testId}`);
        const response = await fetch(`https://api.trustedform.com/v4/certificates/${testId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
          },
        });
        
        console.log(`  Status: ${response.status}`);
        if (response.status !== 404) {
          const text = await response.text();
          console.log(`  Response: ${text.substring(0, 100)}...`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Auth test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

console.log('🔐 TrustedForm Authentication Test');
console.log('==================================');
testTrustedFormAuth();
