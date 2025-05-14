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
    const scheduledBatch = await scheduledBatchesService.getScheduledBatchById(params.id)

    if (!scheduledBatch) {
      return NextResponse.json({ error: "Scheduled batch not found" }, { status: 404 })
    }

    // Check if the user has access to this scheduled batch
    if (scheduledBatch.created_by !== session.user.id) {
      // In a real app, you might want to check for admin roles here
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json(scheduledBatch)
  } catch (error) {
    console.error(`Error fetching scheduled batch ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to fetch scheduled batch" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

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

    const updatedBatch = await scheduledBatchesService.updateScheduledBatch(params.id, body)

    return NextResponse.json(updatedBatch)
  } catch (error) {
    console.error(`Error updating scheduled batch ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to update scheduled batch" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    await scheduledBatchesService.deleteScheduledBatch(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`Error deleting scheduled batch ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to delete scheduled batch" }, { status: 500 })
  }
}
