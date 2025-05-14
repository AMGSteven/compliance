/**
 * Base class for all compliance checkers
 */
export interface ComplianceCheckResult {
  source: string
  compliant: boolean | null
  reasons: string[]
  rawResponse: any
  error?: string
}

export interface ComplianceOptions {
  contactName?: string
  [key: string]: any
}

export abstract class BaseComplianceChecker {
  name = "Base Checker"

  /**
   * Check a phone number for compliance
   *
   * @param phoneNumber The phone number to check
   * @param options Additional options for the check
   * @returns Compliance check result
   */
  abstract checkPhone(phoneNumber: string, options?: ComplianceOptions): Promise<ComplianceCheckResult>
}
