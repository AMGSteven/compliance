#!/usr/bin/env node

/**
 * Test script demonstrating the correct production scenario:
 * - We have a lead with TrustedForm certificate URL
 * - We use the lead's email/phone data for matching
 * - This simulates real-world usage
 */

import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.TRUSTED_FORM_API_KEY;

async function testProductionScenario() {
  try {
    if (!API_KEY) {
      throw new Error('TRUSTED_FORM_API_KEY not found in environment variables');
    }

    console.log('🏢 Testing Production Scenario');
    console.log('==============================');
    console.log('Simulating: Lead comes in with TrustedForm certificate + lead data');
    
    // Simulate a real lead that comes into our system
    const incomingLead = {
      firstName: 'John',
      lastName: 'Doe', 
      email: 'john.doe@example.com', // This would be the actual lead's email
      phone: '+15551234567',         // This would be the actual lead's phone
      trustedFormCertUrl: 'https://cert.trustedform.com/c9c848b2eea97eca5bf90a8a76b422ab283d082c',
      // ... other lead fields
    };

    console.log('\n📧 Incoming Lead Data:');
    console.log('Name:', `${incomingLead.firstName} ${incomingLead.lastName}`);
    console.log('Email:', incomingLead.email);
    console.log('Phone:', incomingLead.phone);
    console.log('TrustedForm Cert:', incomingLead.trustedFormCertUrl);

    // Extract certificate ID
    const certificateId = incomingLead.trustedFormCertUrl.split('/').pop();
    console.log('\n🔗 Extracted Certificate ID:', certificateId);

    // Now attempt to retain the certificate using the LEAD'S data for matching
    console.log('\n🔒 Attempting Certificate Retention...');
    console.log('Using lead data for match_lead operation');

    const requestBody = {
      match_lead: {
        email: incomingLead.email,
        phone: incomingLead.phone,
      },
      retain: {
        reference: `lead-${Date.now()}`,
        vendor: 'Compliance System',
      }
    };

    console.log('\n📋 Request Body:');
    console.log(JSON.stringify(requestBody, null, 2));

    const response = await fetch(`https://cert.trustedform.com/${certificateId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from('API:' + API_KEY).toString('base64')}`,
        'Content-Type': 'application/json',
        'Api-Version': '4.0',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('\n📡 API Response:');
    console.log('Status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('Response:', JSON.stringify(result, null, 2));

      if (result.outcome === 'success') {
        console.log('\n✅ SUCCESS: Certificate retained successfully!');
        console.log('🎯 Lead matching succeeded');
        console.log('💾 Certificate stored in your TrustedForm account');
        
        if (result.retain && result.retain.results) {
          console.log('\n📊 Retention Details:');
          console.log('- Expires at:', result.retain.results.expires_at);
          console.log('- Previously retained:', result.retain.results.previously_retained);
          console.log('- Masked cert URL:', result.retain.results.masked_cert_url);
        }
      } else if (result.outcome === 'failure') {
        console.log('\n❌ RETENTION FAILED:', result.reason);
        
        if (result.match_lead && result.match_lead.result) {
          const matchResult = result.match_lead.result;
          console.log('\n🔍 Match Details:');
          console.log('- Overall success:', matchResult.success);
          console.log('- Email match:', matchResult.email_match);
          console.log('- Phone match:', matchResult.phone_match);
          
          if (!matchResult.email_match && !matchResult.phone_match) {
            console.log('\n💡 Neither email nor phone matched the certificate');
            console.log('   This means:');
            console.log('   - The lead data doesn\'t match what was originally submitted');
            console.log('   - The certificate may belong to a different lead');
            console.log('   - There may be data formatting differences');
          }
        }

        if (result.retain && result.retain.results && result.retain.results.previously_retained) {
          console.log('\n📌 NOTE: Certificate was previously retained in a prior test');
        }
      }
    } else {
      console.log('❌ HTTP Error:', response.status);
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }

    console.log('\n🏭 Production Implementation Notes:');
    console.log('=====================================');
    console.log('✅ In production, this will work when:');
    console.log('   - The certificate URL comes from the same lead submission');
    console.log('   - The email/phone in your lead matches the certificate');
    console.log('   - The certificate hasn\'t been previously retained');
    console.log('');
    console.log('🔧 The auto-claim feature is correctly implemented to:');
    console.log('   - Use the actual lead data (not extract from certificate)');
    console.log('   - Handle both success and failure cases gracefully');
    console.log('   - Not block lead processing if retention fails');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testProductionScenario();
