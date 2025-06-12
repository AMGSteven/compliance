// Pitch BPO Routing Test
// Tests that leads with list_id: pitch-bpo-list-1749233817305 are properly routed to the Pitch BPO dialer
import fetch from 'node-fetch';

async function testPitchBPORouting() {
  // Generate a random phone number to avoid duplicate detection
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const phoneNumber = `925998${randomSuffix}`;
  
  console.log(`Testing Pitch BPO routing with phone: ${phoneNumber}`);
  
  // Create a lead with the correct Pitch BPO list ID
  const lead = {
    first_name: "TestPitchBPO",
    last_name: "RoutingTest",
    email: "test.pitchbpo.routing@example.com",
    phone: phoneNumber,
    list_id: "pitch-bpo-list-1749233817305", // The specific Pitch BPO list ID from routing config
    campaign_id: "pitch-bpo-campaign-1749233817305",
    cadence_id: "pitch-bpo-cadence-1749233817305",
    state: "TX", 
    city: "Austin",
    zip: "78701",
    traffic_source: "routing_test",
    ip_address: "127.0.0.1",
    landing_page: "https://test.compliance.com",
    tc_agreed: true,
    income_bracket: "100000-150000",
    homeowner_status: "Yes",
    age_range: "35-44"
  };
  
  console.log('Sending Pitch BPO routing test payload:', JSON.stringify(lead, null, 2));
  
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
      console.log('✅ Lead submitted successfully');
      console.log('Lead ID:', result.lead_id || result.data?.id);
      
      // Check if it was forwarded to PitchBPO
      if (result.dialer && result.dialer.type === 'pitch_bpo') {
        console.log('\n✅ SUCCESS! Lead was correctly routed to PitchBPO dialer');
        console.log('PitchBPO Status:', result.dialer.status);
        console.log('PitchBPO Response:', result.dialer.response);
      } else if (result.dialer && result.dialer.forwarded) {
        console.log('\n❌ FAILURE! Lead was forwarded but NOT to PitchBPO dialer');
        console.log('Dialer Response:', result.dialer.response);
      } else {
        console.log('\n❌ FAILURE! Lead was not forwarded to any dialer');
      }
      
      // Show the complete data object
      console.log('\nComplete Response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ FAILURE! Lead submission failed');
      console.log('Error:', result.error || 'Unknown error');
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Exception occurred during test:', error.message);
  }
}

// Run the test
testPitchBPORouting();
