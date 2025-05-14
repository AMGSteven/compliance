import { randomBytes } from "crypto"

/**
 * Generates a secure API key with a prefix
 * @returns A secure API key string
 */
export function generateApiKey(): string {
  // Generate 32 random bytes and convert to hex
  const randomString = randomBytes(32).toString("hex")

  // Add a prefix to make it recognizable
  return `jm_${randomString}`
}
