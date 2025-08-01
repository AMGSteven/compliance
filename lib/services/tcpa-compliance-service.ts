/**
 * TCPA Compliance Service
 *
 * This service checks phone numbers against the TCPA Litigator List API
 * to identify potential compliance risks.
 */

import { nanoid } from "nanoid"
import { triggerWebhook } from "../utils/webhook-trigger"

/**
 * Configuration options for the TCPA Compliance Checker
 */
export interface TCPAComplianceCheckerConfig {
  /** API username */
  username: string
  /** API password */
  password: string
  /** Base URL for the API */
  baseUrl?: string
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Initial delay between retries in ms */
  initialRetryDelay?: number
  /** Maximum delay between retries in ms */
  maxRetryDelay?: number
}

/**
 * Phone number with optional contact name
 */
export interface PhoneContact {
  /** Phone number to check */
  phone: string
  /** Optional contact name */
  name?: string
}

/**
 * Result of a compliance check
 */
export interface ComplianceCheckResult {
  /** Whether the phone number is compliant */
  compliant: boolean
  /** Reasons for non-compliance, if any */
  reasons: string[]
  /** Raw API response */
  rawResponse: any
  /** Error message, if any */
  error: string | null
}

/**
 * Batch check result
 */
export interface BatchComplianceCheckResult {
  /** Overall results */
  results: ComplianceCheckResult[]
  /** Number of compliant phone numbers */
  compliantCount: number
  /** Number of non-compliant phone numbers */
  nonCompliantCount: number
  /** Total number of phone numbers checked */
  totalChecked: number
  /** Whether there were any errors */
  hasErrors: boolean
  /** Batch ID */
  batchId: string
}

/**
 * TCPA Compliance Checker
 *
 * Checks phone numbers against the TCPA Litigator List API
 */
export class TCPAComplianceChecker {
  private username: string
  private password: string
  private baseUrl: string
  private maxRetries: number
  private initialRetryDelay: number
  private maxRetryDelay: number

  /**
   * Creates a new TCPA Compliance Checker
   *
   * @param config Configuration options
   */
  constructor(config: TCPAComplianceCheckerConfig) {
    this.username = config.username
    this.password = config.password
    this.baseUrl = config.baseUrl || "https://api.tcpalitigatorlist.com"
    this.maxRetries = config.maxRetries || 3
    this.initialRetryDelay = config.initialRetryDelay || 1000
    this.maxRetryDelay = config.maxRetryDelay || 10000
  }

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
   * Makes an API request with retry logic
   *
   * @param url API endpoint
   * @param method HTTP method
   * @param body Request body
   * @returns API response
   */
  private async makeRequest(url: string, method: string, body: URLSearchParams): Promise<any> {
    let retries = 0
    let delay = this.initialRetryDelay
    let lastError: Error | null = null

    // Limit maximum retries to prevent excessive API calls
    // This replaces the infinite loop (while true) that was causing millions of API calls
    const maxAttempts = this.maxRetries + 1
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Log attempt
        if (attempt > 0) {
          console.log(`TCPA API request retry ${attempt}/${this.maxRetries} for ${url}`)
        }
        
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        })

        // Check for authentication errors (don't retry these)
        if (response.status === 401) {
          throw new Error("Authentication failed. Check your API credentials.")
        }

        // Handle rate limiting with Retry-After header
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          let waitTime = delay
          
          // Use Retry-After header if present
          if (retryAfter) {
            const secondsToWait = parseInt(retryAfter, 10)
            waitTime = isNaN(secondsToWait) ? delay : secondsToWait * 1000
            console.log(`Rate limited. Waiting ${waitTime}ms as specified by Retry-After header.`)
          } else {
            console.log(`Rate limited. Using exponential backoff: waiting ${waitTime}ms.`)
          }
          
          // If we've reached max retries, throw an error
          if (attempt >= this.maxRetries) {
            throw new Error("Rate limit exceeded. Maximum retries reached.")
          }
          
          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          
          // Update delay for next retry if needed
          if (!retryAfter) {
            delay = Math.min(delay * 2, this.maxRetryDelay)
          }
          
          continue
        }

        // Other error responses
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
        }

        // Try to parse JSON response
        try {
          return await response.json()
        } catch (parseError) {
          // JSON parsing errors won't be fixed by retrying
          console.error("JSON parsing error:", parseError)
          throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry json parsing errors
        if (lastError.message.includes("parse")) {
          throw lastError
        }
        
        // If we've reached max retries, throw the last error
        if (attempt >= this.maxRetries) {
          throw lastError
        }
        
        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, delay))
        
        // Increase delay for next retry using exponential backoff
        delay = Math.min(delay * 2, this.maxRetryDelay)
      }
    }

    // This should never be reached due to the loop exit conditions
    throw lastError || new Error("Unknown error during API request")
  }

  /**
   * Checks a single phone number against the TCPA Litigator List API
   *
   * @param phone Phone number to check
   * @param contactName Optional contact name
   * @returns Compliance check result
   */
  async checkPhone(phone: string, contactName?: string): Promise<ComplianceCheckResult> {
    try {
      // Validate phone number
      if (!this.validatePhone(phone)) {
        return {
          compliant: false,
          reasons: ["Invalid phone number format"],
          rawResponse: null,
          error: "Invalid phone number format",
        }
      }

      // Format phone number
      const formattedPhone = this.formatPhone(phone)

      // Prepare request body
      const body = new URLSearchParams()
      body.append("type", JSON.stringify(["tcpa", "dnc"]))
      body.append("phone_number", formattedPhone)

      if (contactName) {
        body.append("contact_name", contactName)
      }

      // Make API request
      const auth = btoa(`${this.username}:${this.password}`)
      const url = `${this.baseUrl}/scrub/phone/`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body,
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // ✅ FIXED: Handle case where data.results is undefined or malformed
      const result = data?.results;
      
      if (!result) {
        console.error('TCPA API returned unexpected response structure:', data);
        throw new Error('TCPA API returned unexpected response structure');
      }

      // ✅ FIXED: Use result.clean === 1 as primary compliance indicator
      // Clean numbers (clean=1) don't have status_array field at all
      // Dirty numbers (clean=0) have status_array with reasons
      const isCompliant = result.clean === 1;
      const statusArray = result.status_array ?? [];
      const reasons = isCompliant ? [] : statusArray;

      return {
        compliant: isCompliant,
        reasons,
        rawResponse: data,
        error: null,
      }
    } catch (error) {
      console.error("TCPA compliance check failed:", error)

      return {
        compliant: false,
        reasons: ["API error"],
        rawResponse: null,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Checks multiple phone numbers against the TCPA Litigator List API
   *
   * @param phones Phone numbers to check
   * @returns Batch compliance check result
   */
  async checkPhones(phones: PhoneContact[]): Promise<BatchComplianceCheckResult> {
    const batchId = nanoid()
    const results: ComplianceCheckResult[] = []
    let compliantCount = 0
    let nonCompliantCount = 0
    let hasErrors = false

    // Validate and filter phone numbers
    const validPhones = phones.filter((contact) => this.validatePhone(contact.phone))

    if (validPhones.length === 0) {
      return {
        results: [],
        compliantCount: 0,
        nonCompliantCount: 0,
        totalChecked: 0,
        hasErrors: true,
        batchId,
      }
    }

    // For small batches (under 100), use the batch endpoint
    if (validPhones.length < 100) {
      try {
        // Prepare request body
        const body = new URLSearchParams()
        body.append("type", JSON.stringify(["tcpa", "dnc"]))
        body.append("small_list", "true")

        // Format phone numbers and names
        const phoneData = validPhones.map((contact) => ({
          phone_number: this.formatPhone(contact.phone),
          contact_name: contact.name || "",
        }))

        body.append("phones", JSON.stringify(phoneData))

        // Make API request
        const auth = btoa(`${this.username}:${this.password}`)
        const url = `${this.baseUrl}/scrub/phones/`

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
          },
          body,
        })

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        // Process response
        for (const [phone, result] of Object.entries(data.results || {})) {
          const typedResult = result as any
          
          // ✅ FIXED: Handle case where individual result is undefined or malformed
          if (!typedResult) {
            console.error('TCPA batch API returned undefined result for phone:', phone);
            results.push({
              compliant: false,
              reasons: ['API returned invalid result'],
              rawResponse: null,
              error: 'Invalid API response structure',
            });
            nonCompliantCount++;
            continue;
          }
          
          // ✅ FIXED: Use typedResult.clean === 1 as primary compliance indicator
          // Clean numbers (clean=1) don't have status_array field at all
          // Dirty numbers (clean=0) have status_array with reasons
          const isCompliant = typedResult.clean === 1;
          const statusArray = typedResult.status_array ?? [];
          const reasons = isCompliant ? [] : statusArray;

          results.push({
            compliant: isCompliant,
            reasons,
            rawResponse: result,
            error: null,
          })

          if (isCompliant) {
            compliantCount++
          } else {
            nonCompliantCount++
          }
        }
      } catch (error) {
        console.error("TCPA batch compliance check failed:", error)
        hasErrors = true

        // Add error result for each phone
        for (const contact of validPhones) {
          results.push({
            compliant: false,
            reasons: ["API error"],
            rawResponse: null,
            error: error instanceof Error ? error.message : "Unknown error",
          })
          nonCompliantCount++
        }
      }
    } else {
      // For larger batches, process in chunks of 50
      const chunkSize = 50
      const chunks = []

      for (let i = 0; i < validPhones.length; i += chunkSize) {
        chunks.push(validPhones.slice(i, i + chunkSize))
      }

      // Process each chunk with a delay to respect rate limits
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(chunk.map((contact) => this.checkPhone(contact.phone, contact.name)))

        results.push(...chunkResults)

        for (const result of chunkResults) {
          if (result.compliant) {
            compliantCount++
          } else {
            nonCompliantCount++
          }

          if (result.error) {
            hasErrors = true
          }
        }

        // Respect rate limits (5 req/sec for batch endpoints)
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }
    }

    // Trigger webhook for batch completion
    try {
      await triggerWebhook("tcpa.batch.completed", {
        batchId,
        totalChecked: results.length,
        compliantCount,
        nonCompliantCount,
        hasErrors,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Failed to trigger webhook for TCPA batch completion:", error)
    }

    return {
      results,
      compliantCount,
      nonCompliantCount,
      totalChecked: results.length,
      hasErrors,
      batchId,
    }
  }
}

/**
 * Default TCPA Compliance Checker instance using environment variables
 */
export const createDefaultTCPAComplianceChecker = () => {
  // Use environment variables for API credentials
  return new TCPAComplianceChecker({
    username: process.env.TCPA_API_USERNAME!,
    password: process.env.TCPA_API_PASSWORD!,
  })
}
