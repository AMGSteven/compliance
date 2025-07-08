import fetch from 'node-fetch';

async function testWebreconNumber(phoneNumber) {
  try {
    const apiKey = process.env.WEBRECON_API_KEY;
    const apiUrl = `https://api.webrecon.net/phone_scrub/${apiKey}`;
    
    console.log(`\n🔍 Testing: ${phoneNumber}`);
    console.log('=' .repeat(50));
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        Phones: cleanNumber
      }]),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('📊 Raw API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Apply our fixed logic
    const totalHits = data.TotalHits || 0;
    const isCompliant = totalHits === 0;
    
    console.log('\n✅ Compliance Check Result:');
    console.log(`- TotalHits: ${totalHits}`);
    console.log(`- IsCompliant: ${isCompliant ? 'YES' : 'NO'}`);
    console.log(`- Status: ${isCompliant ? '✅ CLEAN' : '❌ FLAGGED'}`);
    
    if (!isCompliant) {
      console.log('- Reason: Phone number found in Webrecon database');
    }
    
    return {
      phoneNumber,
      isCompliant,
      totalHits,
      rawResponse: data
    };
    
  } catch (error) {
    console.error(`❌ Error testing ${phoneNumber}:`, error.message);
    return {
      phoneNumber,
      isCompliant: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 Testing Webrecon Checker Fix');
  console.log('='.repeat(60));
  
  const numbersToTest = ['6507769592', '1234567890'];
  
  for (const number of numbersToTest) {
    await testWebreconNumber(number);
  }
  
  console.log('\n🏁 Testing Complete');
}

main().catch(console.error);
