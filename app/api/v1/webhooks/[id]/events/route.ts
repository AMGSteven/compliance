import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"
import { validateApiKey } from "@/lib/middleware/api-key-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const webhookService = new WebhookService()
    const events = await webhookService.getWebhookEvents(params.id)

    return NextResponse.json({ events })
  } catch (error) {
    console.error(`Error fetching events for webhook ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch webhook events" }, { status: 500 })
  }
}
