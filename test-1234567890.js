// Test script for Synergy DNC API with number 1234567890
const testNumber = '1234567890';

// Synergy DNC API endpoint
const synergyDncApiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';

async function testSynergyDncApi() {
  console.log(`Testing Synergy DNC API with number: ${testNumber}`);
  
  try {
    const response = await fetch(synergyDncApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller_id: testNumber })
    });
    
    const data = await response.json();
    console.log('Synergy DNC API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check for the specific rejection_reason
    console.log(`\nRejection reason: ${data.rejection_reason || 'none'}`);
    
    // Verify the response contains internal_dnc as the rejection reason
    if (data.rejection_reason === 'internal_dnc') {
      console.log('✅ VERIFICATION SUCCESSFUL: Number correctly identified as DNC with rejection_reason="internal_dnc"');
    } else {
      console.log(`❌ VERIFICATION FAILED: Expected rejection_reason="internal_dnc" but got "${data.rejection_reason || 'none'}"`);
    }
  } catch (error) {
    console.error('Error testing Synergy DNC API:', error);
  }
}

// Run the test
testSynergyDncApi();
