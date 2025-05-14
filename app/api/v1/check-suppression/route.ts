import { type NextRequest, NextResponse } from "next/server"
import { SuppressionService } from "@/lib/services/suppression-service"
import { ApiKeysRepository } from "@/lib/repositories/api-keys-repository"
import type { SuppressionCheckRequest } from "@/lib/types"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const apiKeysRepo = new ApiKeysRepository()
  const suppressionService = new SuppressionService()

  try {
    // Validate API key if provided
    const apiKey = request.headers.get("Api-Key") || request.headers.get("Authorization")?.replace("Bearer ", "")

    if (apiKey) {
      const { valid } = await apiKeysRepo.validateApiKey(apiKey)
      if (!valid) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
      }
    }

    const body = (await request.json()) as SuppressionCheckRequest

    // Validate request
    if (!body.email && !body.phone && !body.postal) {
      return NextResponse.json(
        { error: "At least one identifier (email, phone, or postal) is required" },
        { status: 400 },
      )
    }

    // Check channel parameter
    const channel = body.channel || "all"
    if (!["all", "email", "phone", "sms", "postal"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel parameter" }, { status: 400 })
    }

    // Check suppression
    const result = await suppressionService.checkSuppression(body)

    // Return suppression status
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error processing suppression check:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
