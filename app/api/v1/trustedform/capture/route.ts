import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trusted-form-service"
import { ApiKeysRepository } from "@/lib/repositories/api-keys-repository"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const trustedFormService = new TrustedFormService()
    const apiKeysRepo = new ApiKeysRepository()

    // Validate API key if provided
    const apiKey = request.headers.get("Api-Key") || request.headers.get("Authorization")?.replace("Bearer ", "")

    if (apiKey) {
      const { valid } = await apiKeysRepo.validateApiKey(apiKey)
      if (!valid) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
      }
    }

    // Validate request
    if (!body.certificateUrl) {
      return NextResponse.json({ error: "Certificate URL is required" }, { status: 400 })
    }

    if (!body.contactData || (!body.contactData.email && !body.contactData.phone)) {
      return NextResponse.json({ error: "Contact data with email or phone is required" }, { status: 400 })
    }

    // Capture certificate
    const result = await trustedFormService.captureCertificate(
      body.certificateUrl,
      body.contactData,
      body.source || "API",
    )

    // Return success response
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error capturing TrustedForm certificate:", error)
    return NextResponse.json({ error: (error as Error).message || "Internal server error" }, { status: 500 })
  }
}
