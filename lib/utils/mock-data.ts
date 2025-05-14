/**
 * Utility functions for generating mock data for testing
 */

// Generate a random TrustedForm certificate ID (40 character hex string)
export function generateMockCertificateId(): string {
  return Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
}

// Generate a random TrustedForm certificate URL
export function generateMockCertificateUrl(): string {
  return `https://cert.trustedform.com/${generateMockCertificateId()}`
}

// Generate a random email address
export function generateMockEmail(): string {
  const domains = ["example.com", "test.com", "mock.org", "sample.net", "demo.io"]
  const firstNames = ["john", "jane", "bob", "alice", "charlie", "emma", "david", "olivia"]
  const lastNames = ["doe", "smith", "johnson", "williams", "brown", "jones", "miller", "davis"]

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  const domain = domains[Math.floor(Math.random() * domains.length)]

  return `${firstName}.${lastName}@${domain}`
}

// Generate a random phone number
export function generateMockPhone(): string {
  return `${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`
}

// Generate a random name
export function generateMockName(): { firstName: string; lastName: string } {
  const firstNames = ["John", "Jane", "Bob", "Alice", "Charlie", "Emma", "David", "Olivia"]
  const lastNames = ["Doe", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis"]

  return {
    firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
  }
}

// Generate a mock TrustedForm certificate with lead data
export function generateMockCertificate() {
  const name = generateMockName()

  return {
    certificateUrl: generateMockCertificateUrl(),
    certificateId: generateMockCertificateId(),
    leadData: {
      email: generateMockEmail(),
      phone: generateMockPhone(),
      firstName: name.firstName,
      lastName: name.lastName,
    },
  }
}

// Generate an array of mock certificates
export function generateMockCertificates(count: number) {
  return Array.from({ length: count }, () => generateMockCertificate())
}
