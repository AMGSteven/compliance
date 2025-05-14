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

    const batchId = params.id
    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    // Get batch results
    const batchRepo = new BatchOperationsRepository()
    const results = await batchRepo.getResultsByBatchId(batchId)

    return NextResponse.json({ results })
  } catch (error) {
    console.error(`Error getting batch results for batch ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to get batch results" }, { status: 500 })
  }
}
