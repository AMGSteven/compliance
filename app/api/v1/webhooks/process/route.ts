import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const webhookService = new WebhookService()
    const results = await webhookService.processPendingEvents()

    return NextResponse.json({
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })
  } catch (error) {
    console.error("Error processing webhooks:", error)
    return NextResponse.json({ error: "Failed to process webhooks" }, { status: 500 })
  }
}
