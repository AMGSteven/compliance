import { type NextRequest, NextResponse } from "next/server"
import { TCPARepository } from "@/lib/repositories/tcpa-repository"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request, ["tcpa:read"])
    if (!apiKeyValidation.valid) {
      return NextResponse.json({ error: apiKeyValidation.error }, { status: apiKeyValidation.status })
    }

    // Get batch ID from params
    const batchId = params.id

    // Create TCPA repository
    const tcpaRepo = new TCPARepository()

    // Get batch check record
    const batchCheck = await tcpaRepo.getBatchCheck(batchId)
    if (!batchCheck) {
      return NextResponse.json({ error: "Batch check not found" }, { status: 404 })
    }

    // Get check results
    const checkResults = await tcpaRepo.getCheckResultsByBatchId(batchId)

    // Return batch check and results
    return NextResponse.json({
      batchId: batchCheck.id,
      status: batchCheck.status,
      totalChecked: batchCheck.totalChecked,
      compliantCount: batchCheck.compliantCount,
      nonCompliantCount: batchCheck.nonCompliantCount,
      hasErrors: batchCheck.hasErrors,
      createdAt: batchCheck.createdAt,
      completedAt: batchCheck.completedAt,
      results: checkResults.map((result) => ({
        phone: result.phone,
        contactName: result.contactName,
        compliant: result.compliant,
        reasons: result.reasons,
      })),
    })
  } catch (error) {
    console.error("Error getting TCPA batch check:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
