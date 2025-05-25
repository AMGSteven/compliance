import type { BaseComplianceChecker, ComplianceOptions } from "./base-compliance-checker"
import { checkPhoneCompliance } from "@/app/lib/real-phone-validation"

/**
 * Phone validation checker that integrates with the RealPhoneValidation API
 * Provides phone line validation such as disconnected, invalid, etc.
 */
export class PhoneValidationChecker implements BaseComplianceChecker {
  name = "Phone Validation"
  
  /**
   * Check a phone number for validity using RealPhoneValidation API
   * 
   * @param phoneNumber The phone number to check
   * @param options Additional options
   * @returns Check result
   */
  async checkPhone(phoneNumber: string, options?: ComplianceOptions) {
    try {
      // Use the existing RealPhoneValidation integration
      const validationResult = await checkPhoneCompliance(phoneNumber)
      
      // Format to match BaseComplianceChecker interface
      return {
        source: this.name,
        compliant: validationResult.isCompliant,
        reasons: validationResult.isCompliant ? [] : [validationResult.reason || "Failed phone validation"],
        rawResponse: validationResult.details,
        phoneNumber
      }
    } catch (error) {
      console.error("Error in phone validation:", error)
      
      // Return a structured error response
      return {
        source: this.name,
        compliant: null, // null indicates error
        reasons: [],
        error: error instanceof Error ? error.message : "Unknown error",
        rawResponse: null,
        phoneNumber
      }
    }
  }
}
