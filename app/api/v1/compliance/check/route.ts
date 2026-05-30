import { type NextRequest, NextResponse } from "next/server"
import { createDefaultComplianceEngine } from "@/lib/services/compliance/compliance-engine"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { 
        isCompliant: false,
        reason: 'Phone number is not compliant',
        checks: {
          tcpa: { isCompliant: false, reason: 'TCPA check failed' },
          blacklist: { isCompliant: false, reason: 'Blacklist check failed' },
          webrecon: { isCompliant: false, reason: 'Webrecon check failed' },
          internalDNC: { isCompliant: false, reason: 'Internal DNC check failed' },
          synergyDNC: { isCompliant: false, reason: 'Synergy DNC check failed' }
        }
      },
      { status: 200 }
    );

    // Validate API key using the middleware
    const apiKeyValidation = await validateApiKey(request);
    
    if (!apiKeyValidation.valid) {
      return NextResponse.json({ error: apiKeyValidation.error }, { status: apiKeyValidation.status });
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
