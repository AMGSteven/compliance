#!/usr/bin/env node

/**
 * Test script to verify the policy postback API accepts compliance_lead_id
 */

async function testPolicyPostback() {
  const baseUrl = 'http://localhost:3001'; // Adjust port if needed
  const endpoint = `${baseUrl}/api/policy-postback`;
  
  // Test with compliance_lead_id (the fix we just made)
  const testPayload = {
    compliance_lead_id: "e955f279-46b9-4d55-96a9-398087598005",
    policy_status: "issued",
    api_key: "test_key_123"
  };
  
  console.log('🧪 Testing Policy Postback API with compliance_lead_id...');
  console.log('📡 Endpoint:', endpoint);
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log('✅ SUCCESS: API accepts compliance_lead_id!');
    } else if (response.status === 404 && result.error === 'Lead not found') {
      console.log('⚠️  EXPECTED: Lead not found (test ID), but API accepted compliance_lead_id field!');
      console.log('✅ FIX CONFIRMED: API no longer rejects compliance_lead_id');
    } else {
      console.log('❌ FAILED: Unexpected response');
    }
    
  } catch (error) {
    console.error('🚨 ERROR:', error.message);
  }
}

// Test with traditional lead_id for comparison
async function testWithLeadId() {
  const baseUrl = 'http://localhost:3001';
  const endpoint = `${baseUrl}/api/policy-postback`;
  
  const testPayload = {
    lead_id: "e955f279-46b9-4d55-96a9-398087598005",
    policy_status: "issued", 
    api_key: "test_key_123"
  };
  
  console.log('\n🧪 Testing Policy Postback API with traditional lead_id...');
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Body:', JSON.stringify(result, null, 2));
    
    if (response.status === 404 && result.error === 'Lead not found') {
      console.log('✅ EXPECTED: Traditional lead_id still works (lead not found is expected with test ID)');
    } else if (response.ok && result.success) {
      console.log('✅ SUCCESS: Traditional lead_id works!');
    } else {
      console.log('❌ ISSUE: Unexpected response for traditional lead_id');
    }
    
  } catch (error) {
    console.error('🚨 ERROR:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Policy Postback API Tests...\n');
  
  await testPolicyPostback();
  await testWithLeadId();
  
  console.log('\n✅ Tests completed!');
  console.log('📝 Summary: Both compliance_lead_id and lead_id should now be accepted by the API');
}

main().catch(console.error);
