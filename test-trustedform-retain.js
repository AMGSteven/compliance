#!/usr/bin/env node

/**
 * Test script for TrustedForm Retain API
 * Usage: node test-trustedform-retain.js
 */

import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config({ path: '.env.local' });

const certificateId = 'c9c848b2eea97eca5bf90a8a76b422ab283d082c';
const API_KEY = process.env.TRUSTED_FORM_API_KEY;

async function testTrustedFormRetain() {
  try {
    if (!API_KEY) {
      throw new Error('TRUSTED_FORM_API_KEY not found in environment variables');
    }

    console.log('Testing TrustedForm API...');
    console.log('Certificate ID:', certificateId);
    console.log('API Key present:', !!API_KEY);

    // First, query the certificate to get the lead data stored on it
    console.log('\n=== Step 1: Querying Certificate Data ===');
    const queryUrl = `https://cert.trustedform.com/${certificateId}`;
    console.log('Query URL:', queryUrl);

    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
        'Content-Type': 'application/json',
        'Api-Version': '4.0'
      },
      body: JSON.stringify({}), // Empty body to get basic certificate info
    });

    console.log('Query response status:', queryResponse.status);
    const queryText = await queryResponse.text();
    console.log('Query response:', queryText);

    let certLeadData = null;
    if (queryResponse.ok) {
      try {
        const certData = JSON.parse(queryText);
        console.log('\n✅ Certificate data retrieved!');
        console.log('Certificate details:', JSON.stringify(certData, null, 2));
        
        // Try to extract lead data from the certificate
        if (certData.verify && certData.verify.lead) {
          certLeadData = certData.verify.lead;
          console.log('\n📧 Extracted lead data from certificate:');
          console.log('Email:', certLeadData.email || 'Not found');
          console.log('Phone:', certLeadData.phone || 'Not found');
        } else {
          console.log('\n⚠️  Could not find lead data in certificate response');
          console.log('Available fields:', Object.keys(certData));
        }
      } catch (e) {
        console.log('\n❌ Failed to parse certificate response:', e.message);
      }
    } else {
      console.log('\n❌ Failed to query certificate:', queryResponse.status);
      if (queryResponse.status === 404) {
        console.log('Certificate not found - may be expired or invalid');
        return;
      }
    }

    console.log('\n=== Step 2: Attempting to Retain Certificate ===')

    // Use extracted lead data from certificate for matching
    let testLeadData;
    if (certLeadData && (certLeadData.email || certLeadData.phone)) {
      testLeadData = {
        ...(certLeadData.email && { email: certLeadData.email }),
        ...(certLeadData.phone && { phone: certLeadData.phone }),
      };
      console.log('\n📋 Using extracted lead data for matching:', testLeadData);
    } else {
      // Fallback to test data if we couldn't extract from certificate
      testLeadData = {
        email: 'test@example.com',
        phone: '+15551234567',
      };
      console.log('\n⚠️  Using fallback test data (matching may fail):', testLeadData);
    }

    const testOptions = {
      reference: `test-retain-${Date.now()}`,
      vendor: 'Compliance System Test',
    };

    console.log('Options:', testOptions);

    // Call TrustedForm Retain API v4.0
    const url = `https://cert.trustedform.com/${certificateId}`;
    console.log('API URL:', url);

    const requestBody = {
      match_lead: {
        email: testLeadData.email,
        phone: testLeadData.phone,
      },
      retain: {
        reference: testOptions.reference,
        vendor: testOptions.vendor,
      }
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
        'Content-Type': 'application/json',
        'Api-Version': '4.0'
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Get the raw response text first
    const responseText = await response.text();
    console.log('Raw response text:', responseText);

    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
      console.log('Parsed response body:', JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.log('Failed to parse JSON response:', parseError.message);
      result = { error: 'Invalid JSON response', raw: responseText };
    }

    if (response.ok) {
      const result = JSON.parse(responseText);
      if (result.outcome === 'success') {
        console.log('\n🎉 SUCCESS: Certificate retained successfully!');
        console.log('✅ Lead matching succeeded');
        console.log('✅ Certificate retention completed');
      } else if (result.outcome === 'failure') {
        console.log('\n❌ RETENTION FAILED:', result.reason);
        if (result.match_lead) {
          console.log('Lead matching result:', result.match_lead.result);
        }
        console.log('\n💡 This means the certificate was NOT retained');
      } else {
        console.log('\n⚠️  Unexpected outcome:', result.outcome);
      }
      if (result.retention) {
        console.log('Retention details:');
        console.log('- Retained at:', result.retention.retained_at);
        console.log('- Reference:', result.retention.reference);
        console.log('- Vendor:', result.retention.vendor);
      }
    } else {
      console.log('\n❌ ERROR: Failed to retain certificate');
      console.log('Error details:', result);
    }

  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testTrustedFormRetain();
