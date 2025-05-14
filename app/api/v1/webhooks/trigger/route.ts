import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventType, payload } = body

    if (!eventType) {
      return NextResponse.json({ error: "Event type is required" }, { status: 400 })
    }

    const webhookService = new WebhookService()
    const events = await webhookService.triggerWebhook(eventType, payload)

    return NextResponse.json({
      success: true,
      events,
    })
  } catch (error) {
    console.error("Error triggering webhook:", error)
    return NextResponse.json({ error: "Failed to trigger webhook" }, { status: 500 })
  }
}
