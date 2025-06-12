// Test script to verify duplicate lead detection
import fetch from 'node-fetch';

const PORT = 3003; // Adjusted to match the current server port

// Use a specific phone number for testing (provided by user)
const testPhone = '7277764739';
const testLead = {
  firstName: "Test",
  lastName: "Duplicate",
  email: "test.duplicate@example.com",
  phone: testPhone, // Specific phone number for testing
  listId: "1b759535-2a5e-421e-9371-3bde7f855c60",
  campaignId: "onpoint-campaign-1",
  state: "CA",
  zipCode: "90210",
  incomeBracket: "$50,000-$75,000",
  homeownerStatus: "Renter",
  dob: "1985-05-15",
  trustedFormCertUrl: "https://cert.trustedform.com/2605d5c9966b957a061503ddb1a8fa1052934295",
  token: "7f108eff2dbf3ab07d562174da6dbe53"
};

async function testDuplicateDetection() {
  console.log('=== DUPLICATE LEAD DETECTION TEST ===');
  console.log(`Testing with phone number: ${testLead.phone}`);
  
  // First submission - should succeed
  console.log('\n1. FIRST SUBMISSION (should succeed)');
  try {
    const response1 = await fetch(`http://localhost:${PORT}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify(testLead)
    });
    
    console.log('Response status:', response1.status);
    const result1 = await response1.json();
    
    if (response1.ok && result1.success) {
      console.log('✅ SUCCESS: First submission was accepted as expected');
      console.log('Response:', JSON.stringify(result1, null, 2));
    } else {
      console.log('❌ UNEXPECTED: First submission was rejected');
      console.log('Error:', result1.error);
      console.log('Details:', JSON.stringify(result1.details, null, 2));
    }
  } catch (error) {
    console.error('Error during first submission:', error);
  }
  
  // Wait a moment before second submission
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Second submission with same phone - should be rejected as duplicate
  console.log('\n2. SECOND SUBMISSION (should be rejected as duplicate)');
  try {
    const response2 = await fetch(`http://localhost:${PORT}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test_key_123'
      },
      body: JSON.stringify({
        ...testLead,
        email: "test.duplicate.again@example.com" // Different email but same phone
      })
    });
    
    console.log('Response status:', response2.status);
    const result2 = await response2.json();
    
    if (!response2.ok && result2.error && result2.error.includes('Duplicate lead')) {
      console.log('✅ SUCCESS: Second submission was correctly rejected as duplicate');
      console.log('Error:', result2.error);
      console.log('Details:', JSON.stringify(result2.details, null, 2));
    } else {
      console.log('❌ UNEXPECTED: Second submission was accepted when it should be rejected as duplicate');
      console.log('Response:', JSON.stringify(result2, null, 2));
    }
  } catch (error) {
    console.error('Error during second submission:', error);
  }
  
  console.log('\n=== TEST COMPLETED ===');
}

// Run the test
testDuplicateDetection().catch(console.error);
