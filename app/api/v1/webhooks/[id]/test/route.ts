import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const webhookService = new WebhookService()
    const result = await webhookService.testWebhook(params.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error(`Error testing webhook ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to test webhook" }, { status: 500 })
  }
}
