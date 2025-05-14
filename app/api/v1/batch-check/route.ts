import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { normalizeEmail, normalizePhone, normalizePostal } from "@/lib/utils"
import type { BatchSuppressionCheckRequest, BatchSuppressionCheckResponse } from "@/lib/types"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createServerClient()

  try {
    const body = (await request.json()) as BatchSuppressionCheckRequest

    // Validate request
    if (!body.contacts || !Array.isArray(body.contacts) || body.contacts.length === 0) {
      return NextResponse.json(
        { error: "The 'contacts' field must be a non-empty array of contact objects" },
        { status: 400 },
      )
    }

    // Check channel parameter
    const channel = body.channel || "all"
    if (!["all", "email", "phone", "sms", "postal"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel parameter" }, { status: 400 })
    }

    // Process each contact
    const results = await Promise.all(
      body.contacts.map(async (contact) => {
        const result: BatchSuppressionCheckResponse["results"][0] = {
          id: contact.id,
          suppressed: false,
          details: {},
        }

        // Check email suppression if provided
        if (contact.email && (channel === "all" || channel === "email")) {
          const normalizedEmail = normalizeEmail(contact.email)

          // Find the contact by email
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("email", normalizedEmail)
            .maybeSingle()

          if (existingContact) {
            // Check if this contact has opted out of email
            const { data: optOut } = await supabase
              .from("opt_outs")
              .select("*")
              .eq("contact_id", existingContact.id)
              .in("channel", ["email", "all"])
              .is("expiration_date", null)
              .maybeSingle()

            result.details.email = !!optOut
            if (optOut) result.suppressed = true
          }
        }

        // Check phone suppression if provided
        if (contact.phone && (channel === "all" || channel === "phone" || channel === "sms")) {
          const normalizedPhone = normalizePhone(contact.phone)

          // Find the contact by phone
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("phone", normalizedPhone)
            .maybeSingle()

          if (existingContact) {
            // Check if this contact has opted out of phone/sms
            const { data: optOut } = await supabase
              .from("opt_outs")
              .select("*")
              .eq("contact_id", existingContact.id)
              .in("channel", [channel === "sms" ? "sms" : "phone", "all"])
              .is("expiration_date", null)
              .maybeSingle()

            result.details.phone = !!optOut
            if (optOut) result.suppressed = true
          }
        }

        // Check postal suppression if provided
        if (contact.postal && (channel === "all" || channel === "postal")) {
          const normalizedPostal = normalizePostal(contact.postal)

          // Find the contact by postal
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("postal", normalizedPostal)
            .maybeSingle()

          if (existingContact) {
            // Check if this contact has opted out of postal
            const { data: optOut } = await supabase
              .from("opt_outs")
              .select("*")
              .eq("contact_id", existingContact.id)
              .in("channel", ["postal", "all"])
              .is("expiration_date", null)
              .maybeSingle()

            result.details.postal = !!optOut
            if (optOut) result.suppressed = true
          }
        }

        return result
      }),
    )

    // Prepare response
    const response: BatchSuppressionCheckResponse = {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      totalProcessed: results.length,
      totalSuppressed: results.filter((r) => r.suppressed).length,
      results,
    }

    // Log the API request
    const endTime = Date.now()
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/batch-check",
      method: "POST",
      request_data: body,
      response_data: response,
      status_code: 200,
      latency: endTime - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    // Return batch results
    return NextResponse.json(response)
  } catch (error) {
    console.error("Error processing batch suppression check:", error)

    // Log the error
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/batch-check",
      method: "POST",
      status_code: 500,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
