import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { ScheduledBatchesService } from "@/lib/services/scheduled-batches-service"

export async function GET() {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scheduledBatchesService = new ScheduledBatchesService()
    const scheduledBatches = await scheduledBatchesService.getScheduledBatchesByUser(session.user.id)

    return NextResponse.json(scheduledBatches)
  } catch (error) {
    console.error("Error fetching scheduled batches:", error)
    return NextResponse.json({ error: "Failed to fetch scheduled batches" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.type || !body.schedule || !body.nextRun || !body.configuration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const scheduledBatchesService = new ScheduledBatchesService()
    const scheduledBatch = await scheduledBatchesService.createScheduledBatch({
      name: body.name,
      type: body.type,
      schedule: body.schedule,
      cron_expression: body.cronExpression,
      next_run: body.nextRun,
      configuration: body.configuration,
      status: "active",
      created_by: session.user.id,
    })

    return NextResponse.json(scheduledBatch)
  } catch (error) {
    console.error("Error creating scheduled batch:", error)
    return NextResponse.json({ error: "Failed to create scheduled batch" }, { status: 500 })
  }
}
