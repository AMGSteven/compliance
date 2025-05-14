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

    const webhook = await webhookService.createWebhook({
      name: body.name,
      url: body.url,
      events: body.events,
      status: "active",
      description: body.description,
      headers: body.headers,
      secret: body.generateSecret ? undefined : body.secret,
      created_by: apiKeyValidation.apiKey?.created_by,
    })

    return NextResponse.json({ webhook })
  } catch (error) {
    console.error("Error creating webhook:", error)
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const apiKeyValidation = await validateApiKey(request)
    if (!apiKeyValidation.valid) {
      return apiKeyValidation.response
    }

    const webhookService = new WebhookService()
    const webhooks = await webhookService.getAllWebhooks()

    return NextResponse.json({ webhooks })
  } catch (error) {
    console.error("Error fetching webhooks:", error)
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 })
  }
}
