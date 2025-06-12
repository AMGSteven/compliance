/**
 * Test to identify which compliance services are running
 */
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3003';
const API_KEY = 'test_key_123';
const ONPOINT_LIST_ID = '1b759535-2a5e-421e-9371-3bde7f855c60';

async function checkServices() {
  console.log('Checking which compliance services are being run...');
  
  // Submit a test lead
  const testLead = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "9295551234", // Using a VoIP number that will be rejected
    state: "CA",
    zipCode: "90210",
    incomeBracket: "$50,000-$75,000",
    homeownerStatus: "Renter",
    ageRange: "35-44",
    listId: ONPOINT_LIST_ID,
    campaignId: "test-campaign",
    trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295"
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(testLead)
    });
    
    const result = await response.json();
    
    // Expected compliance services that should run
    const expectedServices = [
      'TCPA Litigator List',
      'Blacklist Alliance',
      'Webrecon',
      'Internal DNC List',
      'Synergy DNC',
      'Phone Validation'
    ];
    
    // Check which services were actually run
    if (result.details && result.details.complianceResults) {
      const services = result.details.complianceResults.map(r => r.source);
      console.log('\nServices that were checked:');
      services.forEach(service => console.log(`- ${service}`));
      
      console.log(`\nTotal services checked: ${services.length} out of ${expectedServices.length} expected`);
      
      // Find which expected services were not run
      const missingServices = expectedServices.filter(service => !services.includes(service));
      if (missingServices.length > 0) {
        console.log('\nMISSING SERVICES:');
        missingServices.forEach(service => console.log(`- ${service}`));
      } else {
        console.log('\nAll expected services were checked!');
      }
      
      // Additional debug info
      console.log('\nDetailed compliance results:');
      result.details.complianceResults.forEach(result => {
        console.log(`- ${result.source}: ${result.compliant ? 'PASS' : 'FAIL'}`);
        if (!result.compliant && result.reasons) {
          console.log(`  Reasons: ${result.reasons.join(', ')}`);
        }
      });
    } else {
      console.log('No detailed compliance results found in the response');
      console.log('Full response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error checking services:', error.message);
  }
}

// Run the check
checkServices();
