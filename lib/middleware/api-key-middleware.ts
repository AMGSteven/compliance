import { type NextRequest, NextResponse } from "next/server"
import { ApiKeysRepository } from "@/lib/repositories/api-keys-repository"

export async function validateApiKey(request: NextRequest) {
  // Extract API key from headers
  const apiKey = request.headers.get("Api-Key") || request.headers.get("Authorization")?.replace("Bearer ", "")

  if (!apiKey) {
    return {
      valid: false,
      response: NextResponse.json({ error: "API key is required" }, { status: 401 }),
    }
  }

  // Validate API key
  const apiKeysRepo = new ApiKeysRepository()
  const { valid, apiKey: keyDetails } = await apiKeysRepo.validateApiKey(apiKey)

  if (!valid) {
    return {
      valid: false,
      response: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    }
  }

  // Check permissions if needed
  const method = request.method
  if (method !== "GET" && keyDetails?.permissions && !keyDetails.permissions.write) {
    return {
      valid: false,
      response: NextResponse.json({ error: "API key does not have write permission" }, { status: 403 }),
    }
  }

  return { valid: true, apiKey: keyDetails }
}
