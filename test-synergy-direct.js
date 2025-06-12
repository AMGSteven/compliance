// Direct test for Synergy DNC checker
import { SynergyDNCChecker } from './lib/compliance/checkers/synergy-dnc-checker.js';

async function testSynergyDNC() {
  console.log('====== TESTING SYNERGY DNC CHECKER ======');
  
  const checker = new SynergyDNCChecker();
  
  // Test DNC number
  const dncNumber = '9317167522';
  console.log(`Testing DNC number: ${dncNumber}`);
  const dncResult = await checker.checkNumber(dncNumber);
  console.log('Result:', JSON.stringify(dncResult, null, 2));
  console.log(`DNC Number Test: ${!dncResult.isCompliant ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log();
  
  // Test clean number
  const cleanNumber = '6507769592';
  console.log(`Testing clean number: ${cleanNumber}`);
  const cleanResult = await checker.checkNumber(cleanNumber);
  console.log('Result:', JSON.stringify(cleanResult, null, 2));
  console.log(`Clean Number Test: ${cleanResult.isCompliant ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log();
  
  console.log('====== TEST COMPLETE ======');
}

// Run the test
testSynergyDNC().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
