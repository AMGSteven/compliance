// Test lead submission to verify Webrecon fix is working
import fetch from 'node-fetch';

async function testLeadSubmissionWithWebrecon() {
  const baseUrl = 'http://localhost:3000';
  
  // Test with the bypass test number to avoid all compliance checks
  const testLeadData = {
    first_name: "Test",
    last_name: "User", 
    email: "test@example.com",
    phone: "6507769592", // Test bypass number
    address: "123 Test St",
    city: "Test City",
    state: "TX",
    zip_code: "12345",
    dob: "1990-01-01",
    income_bracket: "50000-75000",
    homeowner_status: "own",
    list_id: "a38881ab-93b2-4750-9f9c-92ae6cd10b7e", // Test list ID
    trusted_form_cert_url: "https://cert.trustedform.com/test123",
    transaction_id: "test-tx-" + Date.now()
  };

  console.log('=== Testing Lead Submission (should pass with test number) ===');
  await testLeadSubmission(baseUrl, testLeadData, 'test');
}

async function testLeadSubmission(baseUrl, leadData, expectedResult) {
  try {
    const response = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData)
    });

    const result = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${result.success}`);
    
    if (result.success) {
      console.log(`✅ Lead accepted - phone ${leadData.phone} passed compliance`);
      console.log(`Lead ID: ${result.lead_id}`);
    } else {
      console.log(`❌ Lead rejected - ${result.error}`);
      if (result.details && result.details.complianceResults) {
        const webreconResult = result.details.complianceResults.results.find(r => r.source === 'Webrecon');
        if (webreconResult) {
          console.log(`Webrecon result: ${webreconResult.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
          if (webreconResult.reasons.length > 0) {
            console.log(`Webrecon reasons: ${webreconResult.reasons.join(', ')}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

testLeadSubmissionWithWebrecon().catch(console.error);
