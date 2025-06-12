// Test Script for a specific phone number
import fetch from 'node-fetch';

async function testPhoneNumber() {
  const phoneNumber = '7723615271';
  console.log(`\n=== TESTING PHONE NUMBER: ${phoneNumber} ===\n`);
  
  // Create a lead payload with the specified phone number
  const lead = {
    "first_name": "TestPhone",
    "last_name": "Number5271",
    "email": `test.${phoneNumber}@example.com`,
    "phone": phoneNumber,
    "state": "TX",
    "list_id": "pitch-bpo-list-1749233817305",
    "campaign_id": "pitch-bpo-campaign-1749233817305",
    "cadence_id": "pitch-bpo-cadence-1749233817305",
    "city": "Austin",
    "zip": "78701",
    "income_bracket": "100000-150000",
    "homeowner_status": "Yes",
    "age_range": "35-44",
    "traffic_source": "phone_test",
    "ip_address": "127.0.0.1",
    "landing_page": "https://compliance.juicedmedia.io",
    "tc_agreed": true
  };
  
  console.log('Sending payload with phone:', phoneNumber);
  
  try {
    const response = await fetch('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(lead)
    });
    
    console.log('Response status:', response.status);
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Submission completed with status 200');
      if (result.success) {
        console.log('✅ Lead was accepted successfully');
        console.log('Lead ID:', result.lead_id || result.data?.id);
        
        // Check if it was forwarded to PitchBPO
        if (result.dialer && result.dialer.type === 'pitch_bpo') {
          console.log('✅ Lead was correctly routed to PitchBPO dialer');
          console.log('PitchBPO Status:', result.dialer.status);
          console.log('PitchBPO Response:', result.dialer.response);
        } else if (result.dialer && result.dialer.forwarded) {
          console.log('❓ Lead was forwarded but NOT to PitchBPO dialer');
          console.log('Dialer Type:', result.dialer.type);
          console.log('Dialer Response:', result.dialer.response);
        } else {
          console.log('❓ Lead was not forwarded to any dialer');
        }
      } else {
        console.log('❌ Lead was rejected with success: false');
        console.log('Error:', result.error || 'Unknown error');
        if (result.details) {
          console.log('Details:', JSON.stringify(result.details, null, 2));
        }
      }
    } else {
      console.log('❌ HTTP Error:', response.status);
      console.log('Error:', result.error || 'Unknown error');
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
    }
    
    // Show the complete data object
    console.log('\nComplete Response:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Exception occurred during test:', error.message);
  }
}

// Run the test
testPhoneNumber();
