import { InternalDNCChecker } from '../lib/compliance/checkers/internal-dnc-checker.ts';

async function testDNCChecker() {
  const checker = new InternalDNCChecker();

  try {
    // Test checking a number
    const result = await checker.checkNumber('9999999999');
    console.log('Check result:', result);

    // Test adding a number
    const addResult = await checker.addToDNC({
      phone_number: '8888888888',
      reason: 'Test addition',
      source: 'test',
      added_by: 'test_script'
    });
    console.log('Add result:', addResult);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDNCChecker();
