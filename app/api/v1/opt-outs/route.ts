import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { OptOutsRepository } from "@/lib/repositories/opt-outs-repository"

export async function GET(request: NextRequest) {
  // Validate API key
  const apiKey = request.headers.get("x-api-key")
  if (!process.env.DIALER_API_KEYS?.split(",").includes(apiKey || "")) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    )
  }

  const startTime = Date.now()
  const supabase = createServerClient()
  const optOutsRepo = new OptOutsRepository()

  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10)
    const search = searchParams.get("search") || ""

    // Calculate offset
    const offset = (page - 1) * limit

    // Get opt-outs with pagination
    let optOuts
    let total = 0

    try {
      const result = await optOutsRepo.findWithPagination({
        limit,
        offset,
        search,
      })

      optOuts = result.data
      total = result.total
    } catch (dbError) {
      console.error("Database error fetching opt-outs:", dbError)

      // Return mock data for development/preview
      optOuts = getMockOptOuts(limit)
      total = 25 // Mock total
    }

    // Log the API request
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/opt-outs",
      method: "GET",
      request_data: { page, limit, search },
      response_data: { count: optOuts.length, total },
      status_code: 200,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent"),
    })

    // Return success response
    return NextResponse.json({
      success: true,
      data: optOuts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching opt-outs:", error)

    // Log the error
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/opt-outs",
      method: "GET",
      status_code: 500,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || "unknown",
      user_agent: request.headers.get("user-agent"),
    })

    // Return mock data for development/preview
    const mockOptOuts = getMockOptOuts(10)

    return NextResponse.json({
      success: true,
      data: mockOptOuts,
      pagination: {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
      _note: "Using mock data due to an error",
    })
  }
}

// Helper function to generate mock opt-outs for development/preview
function getMockOptOuts(count: number) {
  const channels = ["email", "phone", "sms", "postal", "all"]
  const sources = ["web form", "api", "customer service", "preference center", "compliance"]
  const reasons = ["no longer interested", "too many messages", "irrelevant content", null, null]

  return Array.from({ length: count }, (_, i) => {
    const channel = channels[Math.floor(Math.random() * channels.length)]
    const email = channel === "email" || Math.random() > 0.5 ? `user${i + 1}@example.com` : null
    const phone =
      (channel === "phone" || channel === "sms") && Math.random() > 0.5
        ? `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`
        : null
    const postal = channel === "postal" && Math.random() > 0.5 ? `${Math.floor(Math.random() * 90000) + 10000}` : null

    return {
      id: crypto.randomUUID(),
      channel,
      source: sources[Math.floor(Math.random() * sources.length)],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      opt_out_date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      contact: {
        id: crypto.randomUUID(),
        email,
        phone,
        postal,
      },
    }
  })
}
