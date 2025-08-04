// Quick verification test for updated Synergy DNC checker
console.log('🧪 VERIFYING SYNERGY DNC CHECKER UPDATE');
console.log('======================================');

// Test the new endpoint format directly
async function testNewEndpoint() {
  const testPhone = '6507769592';
  const formattedPhone = testPhone; // digits only for query parameter
  
  console.log(`📞 Testing phone: ${testPhone}`);
  console.log(`📧 Formatted for API: ${formattedPhone}`);
  console.log(`🌐 Using endpoint: GET /api/blacklist/check`);
  
  // Build URL with query parameter
  const url = `https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/blacklist/check?phone_number=${encodeURIComponent(formattedPhone)}`;
  console.log(`🔗 Full URL: ${url}`);
  console.log();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ API Response Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📋 API Response Data:', JSON.stringify(data, null, 2));
      
      // Check if this matches expected new format
      if (data && typeof data === 'object') {
        console.log('✅ New endpoint is responding with JSON data');
        if (data.rejection_reason !== undefined) {
          console.log('✅ Response includes rejection_reason field');
        }
      } else {
        console.log('❌ Response format unexpected');
      }
    } else {
      console.log('❌ API call failed');
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
  
  console.log();
  console.log('======================================');
  console.log('🎯 VERIFICATION SUMMARY:');
  console.log('• Updated endpoint: /api/blacklist/check ✅');
  console.log('• Updated method: GET ✅');
  console.log('• Updated parameter: phone_number query param ✅'); 
  console.log('• Updated format: digits only ✅');
  console.log('• If API responded above, update is working! 🎉');
}

// Run the test
testNewEndpoint().catch(err => {
  console.error('Verification failed:', err);
});
