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
    const webhook = await webhookService.getWebhookById(params.id)

    return NextResponse.json({ webhook })
  } catch (error) {
    console.error(`Error fetching webhook ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const body = await request.json()
    const webhookService = new WebhookService()

    // Validate request
    if (!body.name || !body.url || !body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ error: "Name, URL, and at least one event are required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(body.url)
    } catch (error) {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    const webhook = await webhookService.updateWebhook(params.id, {
      name: body.name,
      url: body.url,
      events: body.events,
      status: body.status || "active",
      description: body.description,
      headers: body.headers,
    })

    return NextResponse.json({ webhook })
  } catch (error) {
    console.error(`Error updating webhook ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const webhookService = new WebhookService()
    await webhookService.deleteWebhook(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error deleting webhook ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 })
  }
}
