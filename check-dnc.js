// Direct test script for Synergy DNC API - checking for internal_dnc response
const testNumber = '9317167522';
const apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';

async function checkDNC() {
  console.log(`\nChecking if ${testNumber} returns internal_dnc from Synergy API...`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller_id: testNumber
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Print the full response for debugging
    console.log('\nFull API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check specifically for rejection_reason
    console.log('\nDNC Check Results:');
    console.log(`- Accepted: ${data.accepted}`);
    console.log(`- Rejection Reason: ${data.rejection_reason}`);
    
    // Provide a clear conclusion
    if (data.rejection_reason === 'internal_dnc') {
      console.log('\n✅ CONFIRMED: Number returns "internal_dnc" as rejection reason');
    } else {
      console.log('\n❌ NOT CONFIRMED: Number does not return "internal_dnc" as rejection reason');
    }
  } catch (error) {
    console.error('Error calling Synergy DNC API:', error);
  }
}

// Run the check
checkDNC();
