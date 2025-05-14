import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const searchParams = request.nextUrl.searchParams

  try {
    // Parse query parameters
    const status = searchParams.get("status")
    const contactId = searchParams.get("contactId")
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10)
    const offset = (page - 1) * limit

    // Build the query
    let query = supabase
      .from("trusted_form_certificates")
      .select(
        `
        *,
        contact:contact_id (
          id, email, phone
        )
      `,
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters if provided
    if (status) {
      query = query.eq("status", status)
    }

    if (contactId) {
      query = query.eq("contact_id", contactId)
    }

    // Execute the query
    const { data: certificates, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch certificates: ${error.message}`)
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from("trusted_form_certificates")
      .select("*", { count: "exact", head: true })

    // Return the certificates
    return NextResponse.json({
      certificates,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching TrustedForm certificates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
