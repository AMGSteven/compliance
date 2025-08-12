// Check if phone number 4322940704 is on Internal DNC list
const phoneNumber = '4322940704';
const apiUrl = 'https://compliance.juicedmedia.io/api/dialer/dnc';

async function checkInternalDNC() {
  console.log(`🔍 Checking Internal DNC for phone number: ${phoneNumber}`);
  console.log('=' .repeat(60));
  
  try {
    // Use GET request to check if number is on DNC list (same as verify_dnc_batch.js)
    const checkUrl = `${apiUrl}?phone=${phoneNumber}&api_key=test_key_123`;
    console.log(`🌐 Request URL: ${checkUrl}`);
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, Object.fromEntries([...response.headers.entries()]));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error Response: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('\n📄 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n🎯 INTERNAL DNC CHECK RESULTS:');
    console.log('=' .repeat(40));
    
    if (data.success === true) {
      if (data.is_blocked === true) {
        console.log('🚫 RESULT: Phone number IS on the Internal DNC list');
        console.log('🚫 STATUS: This number would be BLOCKED from dialing');
        
        if (data.reasons && data.reasons.length > 0) {
          console.log('📝 Block Reasons:');
          data.reasons.forEach((reason, index) => {
            console.log(`   ${index + 1}. ${reason}`);
          });
        }
        
        if (data.details) {
          console.log('📄 Additional Details:', JSON.stringify(data.details, null, 2));
        }
      } else {
        console.log('✅ RESULT: Phone number is NOT on the Internal DNC list');
        console.log('✅ STATUS: This number would be ALLOWED for dialing');
      }
    } else {
      console.log('❌ RESULT: API call was unsuccessful');
      if (data.error) {
        console.log(`❌ Error: ${data.error}`);
      }
    }
    
    console.log('\n📋 Summary for Phone Number 4322940704:');
    console.log('=' .repeat(50));
    console.log(`📞 Phone Number: ${data.phone_number || phoneNumber}`);
    console.log(`🔒 Is Blocked: ${data.is_blocked}`);
    console.log(`✅ API Success: ${data.success}`);
    
  } catch (error) {
    console.error('💥 Error checking Internal DNC:', error.message);
    console.error('🔧 Full error:', error);
  }
}

// Run the check
console.log('🚀 Starting Internal DNC check for 4322940704...');
checkInternalDNC();
