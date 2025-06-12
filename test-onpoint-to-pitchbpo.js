// OnPoint to PitchBPO lead test
import fetch from 'node-fetch';

async function testOnpointToPitchBPO() {
  // Generate a random phone number to avoid duplicate detection
  // Format: 925998XXXX where XXXX is random
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const phoneNumber = `925998${randomSuffix}`;
  
  console.log(`Testing OnPoint to PitchBPO lead submission with phone: ${phoneNumber}`);
  
  // Create a lead with OnPoint format but targeting PitchBPO dialer
  const lead = {
    firstName: "TestOnPoint",
    lastName: "ToPitchBPO",
    email: "test.onpoint.pitchbpo@example.com",
    phone: phoneNumber,
    listId: "pitch-bpo-list-1749233817305", // Use Pitch BPO list ID
    campaignId: "pitch-bpo-campaign-1749233817305", // Use Pitch BPO campaign ID
    state: "TX", // Using TX which is in the allowed states
    zipCode: "78701",
    incomeBracket: "100000-150000",
    homeownerStatus: "Homeowner",
    ageRange: "35-44", // Using ageRange instead of dob
    cadence_id: "pitch-bpo-cadence-1749233817305", // Add Pitch BPO cadence ID
    dialer_type: 2, // 2 = PitchBPO dialer
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53",
    // Additional fields that might help with compliance and routing
    traffic_source: "onpoint_test_pitchbpo",
    ip_address: "127.0.0.1",
    landing_page: "https://test.compliance.com",
    tc_agreed: true,
    custom1: "OnPointToPitchBPO"
  };
  
  console.log('Sending OnPoint to PitchBPO lead data:', JSON.stringify(lead, null, 2));
  
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
      console.log('✅ SUCCESS! OnPoint to PitchBPO lead submitted successfully');
      console.log('Lead ID:', result.lead_id || result.data?.id);
      console.log('Bid value:', result.bid);
      
      // Check if it was forwarded to PitchBPO
      if (result.dialer?.type === 'pitch_bpo') {
        console.log('\n✅ Lead was successfully forwarded to PitchBPO dialer');
        console.log('PitchBPO Status:', result.dialer.status);
        console.log('PitchBPO Response:', result.dialer.response);
      } else {
        console.log('\n❌ Lead was NOT forwarded to PitchBPO dialer');
      }
      
      // Show the complete data object
      console.log('\nComplete Response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ ERROR! OnPoint to PitchBPO lead submission failed');
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
testOnpointToPitchBPO();
