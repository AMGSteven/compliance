import { type NextRequest, NextResponse } from "next/server"
import { createDefaultTCPAComplianceChecker } from "@/lib/services/tcpa-compliance-service"
import { TCPARepository } from "@/lib/repositories/tcpa-repository"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request, ["tcpa:read", "tcpa:write"])
    if (!apiKeyValidation.valid) {
      return NextResponse.json({ error: apiKeyValidation.error }, { status: apiKeyValidation.status })
    }

    // Parse request body
    const body = await request.json()

    // Validate request
    if (!body.phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    // Create TCPA compliance checker
    const checker = createDefaultTCPAComplianceChecker()

    // Check phone number
    const result = await checker.checkPhone(body.phone, body.contactName)

    // Save result to database
    const tcpaRepo = new TCPARepository()
    await tcpaRepo.createCheckResult({
      phone: body.phone,
      contactName: body.contactName,
      compliant: result.compliant,
      reasons: result.reasons,
      rawResponse: result.rawResponse,
    })

    // Return result
    return NextResponse.json({
      compliant: result.compliant,
      reasons: result.reasons,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    })
  } catch (error) {
    console.error("Error checking TCPA compliance:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
