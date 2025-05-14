import type { TrustedFormVerifyRequest, TrustedFormVerifyResponse } from "@/lib/types/trustedform"

// TrustedForm API key from environment variables
const TRUSTEDFORM_API_KEY = process.env.TRUSTEDFORM_API_KEY || "77fc45c7a5a71ad3fc02b9c0a8a024bc"

/**
 * Service for interacting with the TrustedForm API
 */
export class TrustedFormService {
  /**
   * Verify a TrustedForm certificate
   * @param request The verification request
   * @returns The verification response
   */
  static async verifyCertificate(request: TrustedFormVerifyRequest): Promise<TrustedFormVerifyResponse> {
    try {
      // Extract certificate URL and lead data
      const { certificateUrl, leadData, referenceId, vendor } = request

      // Prepare the payload for TrustedForm API
      const payload = {
        match_lead: {
          email: leadData.email,
          phone: leadData.phone,
        },
        retain: {
          reference: referenceId,
          vendor: vendor || "SuppressionEngine",
        },
      }

      // Make the POST request to TrustedForm
      const response = await fetch(certificateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${TRUSTEDFORM_API_KEY}:`).toString("base64")}`,
        },
        body: JSON.stringify(payload),
      })

      // Parse the response
      const data = await response.json()

      if (!response.ok) {
        console.error("TrustedForm API error:", data)
        return {
          success: false,
          errors: data.errors || ["Failed to verify certificate"],
        }
      }

      // Return the successful response
      return {
        success: true,
        certificate: data,
      }
    } catch (error) {
      console.error("Error verifying TrustedForm certificate:", error)
      return {
        success: false,
        errors: [(error as Error).message],
      }
    }
  }

  /**
   * Parse a TrustedForm certificate URL to extract the certificate ID
   * @param certificateUrl The certificate URL
   * @returns The certificate ID
   */
  static extractCertificateId(certificateUrl: string): string | null {
    try {
      // Extract the certificate ID from the URL
      // Example URL: https://cert.trustedform.com/2605ec3870ea310c85270a62a2f766b8bfa3976f
      const matches = certificateUrl.match(/([a-f0-9]{40})/i)
      return matches ? matches[1] : null
    } catch (error) {
      console.error("Error extracting certificate ID:", error)
      return null
    }
  }

  /**
   * Validate if a string is a valid TrustedForm certificate URL
   * @param url The URL to validate
   * @returns Whether the URL is a valid TrustedForm certificate URL
   */
  static isValidCertificateUrl(url: string): boolean {
    // Check if the URL is a valid TrustedForm certificate URL
    return /^https:\/\/cert\.trustedform\.com\/[a-f0-9]{40}$/i.test(url)
  }
}
