import { TCPAChecker } from './checkers/tcpa-checker.js';
import { BlacklistChecker } from './checkers/blacklist-checker.js';
import { WebreconChecker } from './checkers/webrecon-checker.js';
export class ComplianceEngine {
    constructor() {
        this.checkers = [
            new TCPAChecker(),
            new BlacklistChecker(),
            new WebreconChecker(),
        ];
    }
    async checkPhoneNumber(phoneNumber) {
        // Run all checks in parallel
        const results = await Promise.all(this.checkers.map(checker => checker.checkNumber(phoneNumber)));
        // A number is compliant only if all checks pass
        const isCompliant = results.every(result => result.isCompliant);
        return {
            phoneNumber,
            isCompliant,
            results,
            timestamp: new Date().toISOString(),
        };
    }
    async checkPhoneNumbers(phoneNumbers) {
        return Promise.all(phoneNumbers.map(number => this.checkPhoneNumber(number)));
    }
}
