// Direct test script for Synergy DNC API
const testNumber = '9317167522';
const apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';

async function testSynergyDNCApi() {
  console.log(`Testing Synergy DNC API with number: ${testNumber}`);
  
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
    console.log('Synergy DNC API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Interpret the result
    if (data.on_dnc === true) {
      console.log('✅ RESULT: Number IS on Synergy DNC list');
    } else {
      console.log('❌ RESULT: Number is NOT on Synergy DNC list');
    }
  } catch (error) {
    console.error('Error testing Synergy DNC API:', error);
  }
}

// Run the test
testSynergyDNCApi();
