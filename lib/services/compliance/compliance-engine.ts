import type { BaseComplianceChecker, ComplianceOptions } from "./base-compliance-checker"
import { TCPAComplianceChecker } from "./tcpa-compliance-checker"
import { BlacklistAllianceChecker } from "./blacklist-alliance-checker"
import { SynergyDNCChecker } from "./synergy-dnc-checker"

export interface ComplianceCheckSummary {
  phoneNumber: string
  overallCompliant: boolean | null
  checkResults: any[]
  summary: {
    totalChecks: number
    failedChecks: string[]
    failedReasons: string[]
  }
  timestamp: string
}

export class ComplianceEngine {
  private checkers: BaseComplianceChecker[]

  /**
   * Create a new ComplianceEngine with all available checkers
   */
  constructor() {
    this.checkers = [new TCPAComplianceChecker(), new BlacklistAllianceChecker(), new SynergyDNCChecker()]
  }

  /**
   * Get all available checkers
   *
   * @returns Array of all checkers
   */
  getCheckers(): BaseComplianceChecker[] {
    return [...this.checkers]
  }

  /**
   * Check a phone number against all compliance checkers
   *
   * @param phoneNumber The phone number to check
   * @param options Additional options for the check
   * @returns Comprehensive compliance check results
   */
  async checkCompliance(phoneNumber: string, options?: ComplianceOptions): Promise<ComplianceCheckSummary> {
    const results = []

    // Run all checkers
    for (const checker of this.checkers) {
      try {
        const result = await checker.checkPhone(phoneNumber, options)
        results.push(result)
      } catch (error) {
        results.push({
          source: checker.name,
          compliant: null,
          error: error instanceof Error ? error.message : "Unknown error",
          reasons: [],
          rawResponse: null,
        })
      }
    }

    // Aggregate results
    // If any check returns null (error), overall result is null unless all other checks pass
    const hasErrors = results.some((r) => r.compliant === null)
    const failedChecks = results.filter((r) => r.compliant === false)

    let overallCompliant: boolean | null = null

    if (!hasErrors || results.every((r) => r.compliant === true || r.compliant === null)) {
      // If no errors or all checks either pass or error, we can determine overall compliance
      overallCompliant = failedChecks.length === 0
    }

    return {
      phoneNumber,
      overallCompliant,
      checkResults: results,
      summary: {
        totalChecks: results.length,
        failedChecks: failedChecks.map((r) => r.source),
        failedReasons: failedChecks.flatMap((r) => r.reasons),
      },
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Create a default ComplianceEngine instance
 */
export const createDefaultComplianceEngine = (): ComplianceEngine => {
  return new ComplianceEngine()
}
