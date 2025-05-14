import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BatchOperationsRepository } from "@/lib/repositories/batch-operations-repository"

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    // Get batch operations
    const batchRepo = new BatchOperationsRepository()
    let operations

    if (type) {
      operations = await batchRepo.findByType(type, limit)
    } else {
      operations = await batchRepo.findRecent(limit)
    }

    return NextResponse.json({ operations })
  } catch (error) {
    console.error("Error getting batch operations:", error)
    return NextResponse.json({ error: "Failed to get batch operations" }, { status: 500 })
  }
}
