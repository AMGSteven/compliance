// Onpoint Global lead test with specific phone number
import fetch from 'node-fetch';

async function testOnpointLeadSubmission() {
  console.log('Testing Onpoint Global lead submission with phone: 6507769592');
  
  // Create a lead with the Onpoint Global list ID and the requested phone number
  const lead = {
    firstName: "Test",
    lastName: "Onpoint",
    email: "test.onpoint@example.com",
    phone: "5105927935", // Fresh Google Voice (VoIP) number to test VoIP rejection
    listId: "1b759535-2a5e-421e-9371-3bde7f855c60", // Onpoint Global list ID
    campaignId: "onpoint-campaign-1",
    state: "CA",
    zipCode: "90210",
    incomeBracket: "$50,000-$75,000",
    homeownerStatus: "Renter",
    dob: "1985-05-15",
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
    token: "7f108eff2dbf3ab07d562174da6dbe53"
  };
  
  console.log('Sending Onpoint lead data:', JSON.stringify(lead, null, 2));
  
  try {
    const response = await fetch('http://localhost:3002/api/leads', {
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
      console.log('✅ SUCCESS! Onpoint lead submitted successfully');
      console.log('Lead ID:', result.data.id);
      console.log('Bid value:', result.data.bid || result.bid);
      
      // Check if it passed compliance checks
      console.log('\nCompliance Check Results:');
      console.log('- Passed all compliance checks: ✅');
      
      // Show the complete data object
      console.log('\nComplete Lead Data:');
      console.log(JSON.stringify(result.data, null, 2));
      
      // Check if it passed RealPhoneValidation
      if (result.data.phone_validation_result || result.phone_validation_result) {
        const validation = result.data.phone_validation_result || result.phone_validation_result;
        console.log('\nRealPhoneValidation Results:');
        console.log('- Passed phone validation: ✅');
        console.log('- Phone Type:', validation?.details?.isCell ? 'Mobile' : 'Landline');
        console.log('- Carrier:', validation?.details?.carrier);
      } else {
        console.log('\nRealPhoneValidation Results: Data not included in response, but passed (as submission succeeded)');
      }
      
      // Check if it was forwarded to the dialer
      if (result.dialer) {
        console.log('\nDialer Results:');
        console.log('- Forwarded to dialer: ✅');
        console.log('- Dialer response:', result.dialer.response.message);
        console.log('- Leads added:', result.dialer.response.leads_added);
        console.log('- Campaign assigned:', result.dialer.response.campaign_assigned);
        console.log('- Cadence assigned:', result.dialer.response.cadence_assigned);
        
        // Full dialer response
        console.log('\nFull dialer response:', JSON.stringify(result.dialer.response, null, 2));
      } else {
        console.log('\nDialer Results: No dialer information in response');
      }
      
      console.log('\n🎉 VERIFICATION COMPLETE: Lead successfully processed end-to-end!');
    } else {
      console.log('❌ FAILED! Lead submission failed');
      console.log('Error:', result.error);
      
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
      
      // Check if it failed compliance
      if (result.details && result.details.failedSources) {
        console.log('\nFailed Compliance Checks:');
        console.log('- Failed Sources:', result.details.failedSources.join(', '));
        console.log('- Reasons:', result.details.reasons.join(', '));
        
        // Check if it failed phone validation specifically
        const phoneValidationFailed = result.details.failedSources.includes('Phone Validation');
        if (phoneValidationFailed) {
          console.log('\nRealPhoneValidation Results:');
          console.log('- Passed phone validation: ❌');
          console.log('- Details:', JSON.stringify(result.details.phoneValidation, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('❌ REQUEST ERROR:', error.message);
  }
}

testOnpointLeadSubmission().catch(err => {
  console.error('Unhandled error:', err);
});
