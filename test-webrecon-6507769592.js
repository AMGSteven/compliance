// Test Webrecon checker with specific number 6507769592
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testWebreconWithSpecificNumber() {
  const testNumber = '6507769592';
  
  console.log(`=== Testing Webrecon Checker with ${testNumber} ===`);
  
  try {
    console.log('\n🔧 Testing Raw API Response:');
    const response = await fetch(`https://api.webre-con.com/DNC?num=${testNumber}&api_key=${process.env.WEBRECON_API_KEY}`);
    const apiData = await response.json();
    console.log('Raw API Response:', JSON.stringify(apiData, null, 2));
    
    if (apiData.data && apiData.data.length > 0) {
      const row = apiData.data[0];
      console.log(`\n📊 Score Analysis:`);
      console.log(`- row.Score: "${row.Score}"`);
      console.log(`- Score === "": ${row.Score === ''}`);
      console.log(`- Score === "0": ${row.Score === '0'}`);
      console.log(`- Should be compliant: ${row.Score === '' || row.Score === '0'}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing Webrecon:', error.message);
  }
}

testWebreconWithSpecificNumber().catch(console.error);
