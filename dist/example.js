import { ComplianceEngine } from './engine.js';
async function example() {
    const engine = new ComplianceEngine();
    try {
        // Check a single number
        const report = await engine.checkPhoneNumber('2125551234');
        console.log('Single number check:', JSON.stringify(report, null, 2));
        // Check multiple numbers
        const batchReport = await engine.checkPhoneNumbers(['2125551234', '3475559876']);
        console.log('Batch check:', JSON.stringify(batchReport, null, 2));
    }
    catch (error) {
        console.error('Error:', error);
    }
}
// Run the example
example();
