import { type NextRequest, NextResponse } from "next/server"
import { createDefaultComplianceEngine } from "@/lib/services/compliance/compliance-engine"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request, ["compliance:read", "compliance:write"])
    if (!apiKeyValidation.valid) {
      return NextResponse.json({ error: apiKeyValidation.error }, { status: apiKeyValidation.status })
    }

    // Parse request body
    const body = await request.json()

    // Validate request
    if (!body.phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    // Create compliance engine
    const engine = createDefaultComplianceEngine()

    // Check phone number
    const result = await engine.checkCompliance(body.phone, {
      contactName: body.contactName,
    })

    // Return result
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error checking compliance:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
