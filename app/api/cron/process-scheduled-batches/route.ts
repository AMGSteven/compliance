import { type NextRequest, NextResponse } from "next/server"
import { ScheduledBatchesService } from "@/lib/services/scheduled-batches-service"

export async function GET(request: NextRequest) {
  // Verify the cron secret
  const authHeader = request.headers.get("authorization")
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const scheduledBatchesService = new ScheduledBatchesService()
    const result = await scheduledBatchesService.processDueScheduledBatches()

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} scheduled batches: ${result.succeeded} succeeded, ${result.failed} failed`,
      ...result,
    })
  } catch (error) {
    console.error("Error processing scheduled batches:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process scheduled batches",
      },
      { status: 500 },
    )
  }
}
