/**
 * Quick Manual Test for Historical Bid Tracking
 * Simple script to test basic functionality
 */

const baseUrl = 'http://localhost:3001';
const apiKey = 'test_key_123';
const listId = 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e'; // TEST_JUICED_MEDIA_LIST_ID for test phone

// Test payload for standard lead (all required fields)
const testLead = {
  firstName: 'BidTest',
  lastName: 'User', 
  email: 'bidtest@example.com',
  phone: '6507769592', // Use test phone number that bypasses compliance
  address: '123 Test St',
  city: 'Birmingham',
  state: 'AL',
  zipCode: '35203',
  trustedFormCertUrl: 'https://cert.trustedform.com/0000000000000000000000000000000000000000', // Valid format for testing
  source: 'TestAPI',
  listId: listId,
  campaignId: 'test-campaign',
  incomeBracket: '$50,000-$75,000',
  homeownerStatus: 'Own',
  ageRange: '35-44',
  bidValue: 15.00
};

async function testBidStorage() {
  console.log('🧪 Quick Bid Storage Test');
  console.log('========================');
  
  try {
    console.log('📤 Submitting test lead...');
    
    const response = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testLead)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Lead submitted successfully!');
      console.log(`   Success: ${result.success}`);
      console.log(`   Bid: $${result.bid || 'N/A'}`);
      console.log(`   Phone: ${testLead.Phone}`);
      console.log('');
      console.log('🔍 Now check your database:');
      console.log(`   SELECT bid_amount, first_name, last_name, phone FROM leads WHERE phone = '${testLead.Phone}' ORDER BY created_at DESC LIMIT 1;`);
    } else {
      console.log('❌ Lead submission failed:');
      console.log('   Error:', result.error);
      console.log('   Details:', result.details || result.message);
    }
  } catch (error) {
    console.log('💥 Request failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBidStorage();
}

export { testBidStorage };
