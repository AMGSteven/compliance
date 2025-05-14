import { BaseComplianceChecker, type ComplianceCheckResult, type ComplianceOptions } from "./base-compliance-checker"

export class TCPAComplianceChecker extends BaseComplianceChecker {
  name = "TCPA Litigator List"

  // HARDCODED CREDENTIALS AS REQUESTED
  private username = "tcpa_tI0B1esXbt"
  private password = "CPFC jkfP pWbB KOlN 11x2 5oVR"
  private baseUrl = "https://api.tcpalitigatorlist.com"

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
   * Check a phone number against the TCPA Litigator List
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

      // Prepare request body
      const body = new URLSearchParams()
      body.append("type", JSON.stringify(["tcpa", "dnc"]))
      body.append("phone_number", formattedPhone)

      if (options?.contactName) {
        body.append("contact_name", options.contactName)
      }

      // Make API request
      const auth = btoa(`${this.username}:${this.password}`)
      const response = await fetch(`${this.baseUrl}/scrub/phone/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body,
      })

      if (!response.ok) {
        throw new Error(`TCPA API request failed with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Process response
      const isCompliant = data.results.clean === 1
      const reasons = isCompliant ? [] : data.results.status_array || [data.results.status || "Unknown reason"]

      return {
        source: this.name,
        compliant: isCompliant,
        reasons,
        rawResponse: data,
      }
    } catch (error) {
      console.error("TCPA compliance check failed:", error)

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
