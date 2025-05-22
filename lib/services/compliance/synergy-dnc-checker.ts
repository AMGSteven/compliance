import { BaseComplianceChecker, type ComplianceCheckResult, type ComplianceOptions } from "./base-compliance-checker"

export class SynergyDNCChecker extends BaseComplianceChecker {
  name = "Synergy DNC"
  private baseUrl = "https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping"

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
   * Check a phone number against the Synergy DNC API
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

      // Make API request to check caller ID against Synergy DNC
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          caller_id: formattedPhone
        }),
      })

      if (!response.ok) {
        throw new Error(`Synergy DNC API request failed with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Process response - if the number is on DNC list, it's not compliant
      // We'll consider it compliant if it's not on the DNC list
      const isOnDNC = data?.on_dnc === true
      const isCompliant = !isOnDNC
      const reasons = isOnDNC ? ["Number found on Synergy DNC list"] : []

      return {
        source: this.name,
        compliant: isCompliant,
        reasons,
        rawResponse: data,
      }
    } catch (error) {
      console.error("Synergy DNC compliance check failed:", error)

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
