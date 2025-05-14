import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trusted-form-service"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { items, referenceId, vendor } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Items array is required and must not be empty." },
        { status: 400 },
      )
    }

    const trustedFormService = new TrustedFormService()
    const result = await trustedFormService.createBatchVerification(items, user.id, {
      referenceId,
      vendor,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating batch verification:", error)
    return NextResponse.json({ error: "Failed to create batch verification" }, { status: 500 })
  }
}
