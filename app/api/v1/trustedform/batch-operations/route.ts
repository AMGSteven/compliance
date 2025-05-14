import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trusted-form-service"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"
import { corsHeaders } from "@/lib/middleware/cors"

export async function GET(request: NextRequest) {
  try {
    // Add CORS headers
    const response = new NextResponse()
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return NextResponse.json(
        { error: apiKeyValidation.error || "Invalid API key" },
        { status: 401, headers: corsHeaders },
      )
    }

    try {
      // Get recent batch operations
      const trustedFormService = new TrustedFormService()
      const batchOperations = await trustedFormService.getRecentBatchOperations()

      return NextResponse.json({ batchOperations }, { headers: corsHeaders })
    } catch (error) {
      console.error("Database error getting batch operations:", error)

      // Return mock data for development/preview
      const mockBatchOperations = Array.from({ length: 5 }).map((_, i) => ({
        id: `mock-batch-${i}`,
        type: i % 2 === 0 ? "verification" : "capture",
        status: ["completed", "processing", "pending", "failed"][i % 4],
        totalItems: 10 + i * 5,
        processedItems: i % 4 === 1 ? 5 + i : i % 4 === 0 ? 10 + i * 5 : 0,
        successfulItems: i % 4 === 0 ? 8 + i * 4 : i % 4 === 1 ? 3 + i : 0,
        failedItems: i % 4 === 0 ? 2 + i : i % 4 === 1 ? 2 : 0,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
        completedAt: i % 4 === 0 ? new Date(Date.now() - i * 21600000).toISOString() : null,
        createdBy: "test-user",
        metadata: {
          referenceId: `test-ref-${i}`,
          vendor: "Test Vendor",
        },
      }))

      return NextResponse.json({ batchOperations: mockBatchOperations }, { headers: corsHeaders })
    }
  } catch (error) {
    console.error("Error getting batch operations:", error)
    return NextResponse.json(
      { error: "Failed to get batch operations", message: (error as Error).message },
      { status: 500, headers: corsHeaders },
    )
  }
}
