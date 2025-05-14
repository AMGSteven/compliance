import { type NextRequest, NextResponse } from "next/server"
import { WebhookService } from "@/lib/services/webhook-service"

// This route is meant to be called by a cron job service like Vercel Cron
export async function GET(request: NextRequest) {
  try {
    // Check for a secret key to prevent unauthorized access
    const authHeader = request.headers.get("authorization")
    const expectedSecret = process.env.CRON_SECRET

    if (
      expectedSecret &&
      (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== expectedSecret)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const webhookService = new WebhookService()
    const results = await webhookService.processPendingEvents(50) // Process up to 50 events at a time

    return NextResponse.json({
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error processing webhooks:", error)
    return NextResponse.json({ error: "Failed to process webhooks" }, { status: 500 })
  }
}
