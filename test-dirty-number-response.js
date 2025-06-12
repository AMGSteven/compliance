// Test script to check response from Synergy DNC API for a known DNC number
const fetch = require('node-fetch');

// Known DNC number to test
const dirtyNumber = '9317167522';

async function testSynergyDNC() {
  console.log(`Testing Synergy DNC API with dirty number: ${dirtyNumber}`);
  
  try {
    // Format phone number (remove non-digits)
    const formattedPhone = dirtyNumber.replace(/\D/g, '');
    
    // Make API request to Synergy DNC API
    const response = await fetch('https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller_id: formattedPhone
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract key fields from the response
    const {
      rejection_reason,
      on_dnc,
      success,
      error
    } = data;
    
    // Print a simplified response that focuses on the DNC fields
    console.log('\nSYNERGY DNC API RESPONSE:');
    console.log('=======================');
    console.log(`Phone Number: ${formattedPhone}`);
    console.log(`Success: ${success}`);
    console.log(`Rejection Reason: ${rejection_reason || 'None'}`);
    console.log(`On DNC: ${on_dnc || false}`);
    console.log(`Error: ${error || 'None'}`);
    console.log('=======================\n');
    
    // Verify if this is a DNC number according to our implementation logic
    // Our Synergy DNC checker considers a number to be on DNC if rejection_reason === 'internal_dnc'
    const isOnDNC = rejection_reason === 'internal_dnc';
    
    if (isOnDNC) {
      console.log('✅ NUMBER IS ON DNC: rejection_reason="internal_dnc"');
    } else {
      console.log('❌ NUMBER IS NOT ON DNC: rejection_reason is not "internal_dnc"');
    }
    
    // Print full response for reference
    console.log('\nFull API Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error testing Synergy DNC API:', error);
  }
}

// Run the test
testSynergyDNC();
