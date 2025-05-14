import { BaseComplianceChecker, type ComplianceCheckResult, type ComplianceOptions } from "./base-compliance-checker"

export class BlacklistAllianceChecker extends BaseComplianceChecker {
  name = "Blacklist Alliance"

  // HARDCODED CREDENTIALS AS REQUESTED
  private apiKey = "2tMFT86TJpyTQfAyRBae"
  private baseUrl = "https://api.blacklist-alliance.com/standard/api/v1"

  /**
   * Validates a phone number
   *
   * @param phone Phone number to validate
   * @returns Whether the phone number is valid
   */
  private validatePhone(phone: string): boolean {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "")

    // Check if the result is a valid phone number (10-15 digits)
    return digits.length >= 10 && digits.length <= 15
  }

  /**
   * Formats a phone number for the API
   *
   * @param phone Phone number to format
   * @returns Formatted phone number
   */
  private formatPhone(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, "")
  }

  /**
   * Check a phone number against the Blacklist Alliance API
   *
   * @param phoneNumber The phone number to check
   * @param options Additional options for the check
   * @returns Compliance check result
   */
  async checkPhone(phoneNumber: string, options?: ComplianceOptions): Promise<ComplianceCheckResult> {
    try {
      // Validate phone number
      if (!this.validatePhone(phoneNumber)) {
        return {
          source: this.name,
          compliant: false,
          reasons: ["Invalid phone number format"],
          rawResponse: null,
          error: "Invalid phone number format",
        }
      }

      // Format phone number
      const formattedPhone = this.formatPhone(phoneNumber)

      // Make API request
      const response = await fetch(`${this.baseUrl}/lookup/single/${formattedPhone}`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
        },
      })

      if (!response.ok) {
        throw new Error(`Blacklist Alliance API request failed with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Process response
      const isCompliant = !data.blacklisted
      const reasons = data.blacklisted ? data.categories || ["Blacklisted"] : []

      return {
        source: this.name,
        compliant: isCompliant,
        reasons,
        rawResponse: data,
      }
    } catch (error) {
      console.error("Blacklist Alliance compliance check failed:", error)

      return {
        source: this.name,
        compliant: null,
        reasons: [],
        rawResponse: null,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
