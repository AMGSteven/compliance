import { ComplianceChecker, ComplianceReport } from './types';
import { TCPAChecker } from './checkers/tcpa-checker';
import { BlacklistChecker } from './checkers/blacklist-checker';
import { WebreconChecker } from './checkers/webrecon-checker';
import { InternalDNCChecker } from './checkers/internal-dnc-checker';

export class ComplianceEngine {
  private checkers: ComplianceChecker[];

  constructor() {
    this.checkers = [
      new TCPAChecker(),
      new BlacklistChecker(),
      new WebreconChecker(),
      new InternalDNCChecker(),
    ];
  }

  async checkPhoneNumber(phoneNumber: string): Promise<ComplianceReport> {
    try {
      console.log('Running compliance checks for:', phoneNumber);
      // Run all checks in parallel
      const results = await Promise.allSettled(
        this.checkers.map(async checker => {
          try {
            console.log(`Running checker: ${checker.name}`);
            const result = await checker.checkNumber(phoneNumber);
            console.log(`Checker ${checker.name} result:`, result);
            return result;
          } catch (error) {
            console.error(`Error in checker ${checker.name}:`, error);
            return {
              isCompliant: true, // Fail open
              reasons: [`Error in ${checker.name}: ${error instanceof Error ? error.message : 'Unknown error'}`],
              source: checker.name,
              details: {},
              phoneNumber,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      // Filter out rejected promises and map to values
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      // A number is compliant only if all checks pass
      const isCompliant = successfulResults.every(result => result.isCompliant);
      
      console.log('Final compliance result:', { isCompliant, results: successfulResults });

      return {
        phoneNumber,
        isCompliant,
        results: successfulResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in ComplianceEngine:', error);
      throw error;
    }
  }

  async checkPhoneNumbers(phoneNumbers: string[]): Promise<ComplianceReport[]> {
    return Promise.all(phoneNumbers.map(number => this.checkPhoneNumber(number)));
  }
}
