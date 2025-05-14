import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trusted-form-service"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const batchId = params.id
    const includeResults = request.nextUrl.searchParams.get("includeResults") === "true"

    const trustedFormService = new TrustedFormService()
    const batch = await trustedFormService.getBatchVerification(batchId)

    if (!batch) {
      return NextResponse.json({ error: "Batch verification not found" }, { status: 404 })
    }

    // If includeResults is false, remove the results array to reduce payload size
    if (!includeResults && batch.results) {
      delete batch.results
    }

    return NextResponse.json(batch)
  } catch (error) {
    console.error(`Error getting batch verification ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to get batch verification" }, { status: 500 })
  }
}
