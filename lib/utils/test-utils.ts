/**
 * Generate a random email address for testing
 */
export function generateTestEmail(): string {
  const randomString = Math.random().toString(36).substring(2, 8)
  return `test-${randomString}@example.com`
}

/**
 * Generate a random phone number for testing
 */
export function generateTestPhone(): string {
  // Generate a random 10-digit US phone number
  const areaCode = Math.floor(Math.random() * 900) + 100
  const prefix = Math.floor(Math.random() * 900) + 100
  const lineNumber = Math.floor(Math.random() * 9000) + 1000
  return `${areaCode}${prefix}${lineNumber}`
}

/**
 * Generate a random postal code for testing
 */
export function generateTestPostal(): string {
  // Generate a random 5-digit US ZIP code
  return `${Math.floor(Math.random() * 90000) + 10000}`
}

/**
 * Sample test data for compliance and suppression testing
 */
export const sampleTestData = {
  // Known TCPA litigator test numbers
  tcpaTestNumbers: [
    { phone: "2012510414", description: "Common TCPA test number" },
    { phone: "7027271296", description: "Potential litigator number" },
    { phone: "4044197173", description: "Potential DNC complainer" },
  ],

  // Random test data
  randomEmails: Array(3)
    .fill(0)
    .map(() => generateTestEmail()),
  randomPhones: Array(3)
    .fill(0)
    .map(() => generateTestPhone()),
  randomPostals: Array(3)
    .fill(0)
    .map(() => generateTestPostal()),
}

/**
 * Format a JSON object for display
 */
export function formatJson(json: any): string {
  return JSON.stringify(json, null, 2)
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ""

  // Strip all non-numeric characters
  const cleaned = phone.replace(/\D/g, "")

  // Format as (XXX) XXX-XXXX if 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
  }

  // Otherwise return as is
  return phone
}
