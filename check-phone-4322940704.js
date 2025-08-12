// Direct Internal DNC check using the same class as the API endpoint
const path = require('path');

// Since we're in ES module mode, we need to use dynamic import
async function checkPhone() {
  const phoneNumber = '4322940704';
  console.log('🔍 Checking Internal DNC for:', phoneNumber);
  console.log('=' .repeat(50));
  
  try {
    // Import the InternalDNCChecker class
    const { InternalDNCChecker } = await import('./lib/compliance/checkers/internal-dnc-checker.js');
    
    console.log('📞 Creating InternalDNCChecker instance...');
    const checker = new InternalDNCChecker();
    
    console.log('🔄 Running DNC check (this is the same check used by /api/dialer/dnc)...');
    const result = await checker.checkNumber(phoneNumber);
    
    console.log('\n📊 RESULTS:');
    console.log('=' .repeat(30));
    console.log(`📋 Is Compliant: ${result.isCompliant}`);
    console.log(`📋 Phone Number: ${result.phoneNumber}`);
    console.log(`📋 Source: ${result.source}`);
    
    if (result.reasons && result.reasons.length > 0) {
      console.log(`🚫 Reasons:`);
      result.reasons.forEach((reason, index) => {
        console.log(`   ${index + 1}. ${reason}`);
      });
    }
    
    if (result.details) {
      console.log(`📄 Details:`, JSON.stringify(result.details, null, 2));
    }
    
    if (result.rawResponse) {
      console.log(`🗃️  Database Record:`, JSON.stringify(result.rawResponse, null, 2));
    }
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    }
    
    console.log('\n🎯 FINAL RESULT:');
    console.log('=' .repeat(30));
    if (result.isCompliant) {
      console.log('✅ Phone number 4322940704 is NOT on the Internal DNC list');
      console.log('✅ This number would be ALLOWED for dialing');
    } else {
      console.log('🚫 Phone number 4322940704 IS on the Internal DNC list');
      console.log('🚫 This number would be BLOCKED from dialing');
      
      if (result.reasons && result.reasons.length > 0) {
        console.log('📝 Block reasons:', result.reasons.join(', '));
      }
    }
    
    // Also return the API-style response like the /api/dialer/dnc endpoint does
    const apiResponse = {
      success: true,
      is_blocked: !result.isCompliant,
      phone_number: result.phoneNumber,
      reasons: result.reasons,
      details: result.details
    };
    
    console.log('\n🔌 API Response Format (same as /api/dialer/dnc):');
    console.log(JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('🔧 Stack:', error.stack);
  }
}

// Run the check
checkPhone();
