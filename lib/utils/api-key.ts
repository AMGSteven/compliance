/**
 * Generates a secure API key with a prefix
 * @returns A secure API key string
 */
export function generateApiKey(): string {
  // Generate 32 random bytes using Web Crypto API
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  
  // Convert to hex string
  const randomString = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // Add a prefix to make it recognizable
  return `jm_${randomString}`
}

export function generateId(): string {
  // Generate 16 random bytes for ID
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
