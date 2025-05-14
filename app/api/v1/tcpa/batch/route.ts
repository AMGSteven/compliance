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
    if (!body.phones || !Array.isArray(body.phones) || body.phones.length === 0) {
      return NextResponse.json({ error: "Phones array is required" }, { status: 400 })
    }

    // Create TCPA repository
    const tcpaRepo = new TCPARepository()

    // Create batch check record
    const batchCheck = await tcpaRepo.createBatchCheck({
      totalChecked: body.phones.length,
      compliantCount: 0,
      nonCompliantCount: 0,
      hasErrors: false,
      status: "processing",
      createdBy: apiKeyValidation.apiKey?.created_by || undefined,
    })

    // Process batch asynchronously
    processBatch(body.phones, batchCheck.id).catch((error) => {
      console.error("Error processing TCPA batch:", error)
    })

    // Return batch ID
    return NextResponse.json({
      batchId: batchCheck.id,
      status: "processing",
      totalPhones: body.phones.length,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    })
  } catch (error) {
    console.error("Error creating TCPA batch check:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

async function processBatch(phones: any[], batchId: string) {
  try {
    // Create TCPA compliance checker
    const checker = createDefaultTCPAComplianceChecker()

    // Create TCPA repository
    const tcpaRepo = new TCPARepository()

    // Process phones
    const phoneContacts = phones.map((phone) => {
      if (typeof phone === "string") {
        return { phone }
      }
      return {
        phone: phone.phone,
        name: phone.name || phone.contactName,
      }
    })

    // Check phones
    const result = await checker.checkPhones(phoneContacts)

    // Save results to database
    for (let i = 0; i < result.results.length; i++) {
      const checkResult = result.results[i]
      const phone = phoneContacts[i]

      await tcpaRepo.createCheckResult({
        phone: phone.phone,
        contactName: phone.name,
        compliant: checkResult.compliant,
        reasons: checkResult.reasons,
        rawResponse: checkResult.rawResponse,
        batchId,
      })
    }

    // Update batch check record
    await tcpaRepo.updateBatchCheck(batchId, {
      totalChecked: result.totalChecked,
      compliantCount: result.compliantCount,
      nonCompliantCount: result.nonCompliantCount,
      hasErrors: result.hasErrors,
      completedAt: new Date().toISOString(),
      status: "completed",
    })
  } catch (error) {
    console.error("Error processing TCPA batch:", error)

    // Update batch check record with error
    const tcpaRepo = new TCPARepository()
    await tcpaRepo.updateBatchCheck(batchId, {
      hasErrors: true,
      completedAt: new Date().toISOString(),
      status: "failed",
    })
  }
}
