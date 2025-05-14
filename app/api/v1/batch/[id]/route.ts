import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BatchOperationsRepository } from "@/lib/repositories/batch-operations-repository"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get the authenticated user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the batch operation
    const batchId = params.id
    const batchRepo = new BatchOperationsRepository()
    const batch = await batchRepo.findWithResults(batchId)

    if (!batch) {
      return NextResponse.json({ error: "Batch operation not found" }, { status: 404 })
    }

    return NextResponse.json({ batch })
  } catch (error) {
    console.error(`Error getting batch operation ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to get batch operation" }, { status: 500 })
  }
}
