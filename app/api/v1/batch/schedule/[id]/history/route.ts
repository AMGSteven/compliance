import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ScheduledBatchesService } from "@/lib/services/scheduled-batches-service"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scheduledBatchesService = new ScheduledBatchesService()
    const existingBatch = await scheduledBatchesService.getScheduledBatchById(params.id)

    if (!existingBatch) {
      return NextResponse.json({ error: "Scheduled batch not found" }, { status: 404 })
    }

    // Check if the user has access to this scheduled batch
    if (existingBatch.created_by !== session.user.id) {
      // In a real app, you might want to check for admin roles here
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const history = await scheduledBatchesService.getScheduledBatchHistory(params.id)

    return NextResponse.json(history)
  } catch (error) {
    console.error(`Error fetching history for scheduled batch ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch scheduled batch history" }, { status: 500 })
  }
}
