import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { normalizeEmail, normalizePhone, normalizePostal } from "@/lib/utils"
import type { OptOutRequest } from "@/lib/types"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createServerClient()

  try {
    const body = (await request.json()) as OptOutRequest

    // Validate request
    if (!body.identifier) {
      return NextResponse.json({ error: "Identifier is required" }, { status: 400 })
    }

    if (!body.identifierType || !["email", "phone", "postal"].includes(body.identifierType)) {
      return NextResponse.json(
        { error: "Valid identifier type is required (email, phone, or postal)" },
        { status: 400 },
      )
    }

    if (!body.channel || !["email", "phone", "sms", "postal", "all"].includes(body.channel)) {
      return NextResponse.json(
        { error: "Valid channel is required (email, phone, sms, postal, or all)" },
        { status: 400 },
      )
    }

    if (!body.source) {
      return NextResponse.json({ error: "Source is required" }, { status: 400 })
    }

    // Normalize the identifier based on type
    let normalizedIdentifier: string
    switch (body.identifierType) {
      case "email":
        normalizedIdentifier = normalizeEmail(body.identifier)
        break
      case "phone":
        normalizedIdentifier = normalizePhone(body.identifier)
        break
      case "postal":
        normalizedIdentifier = normalizePostal(body.identifier)
        break
    }

    // Check if contact exists, create if not
    let contactId: string
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq(body.identifierType, normalizedIdentifier)
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
    } else {
      // Create new contact
      const { data: newContact, error } = await supabase
        .from("contacts")
        .insert({
          [body.identifierType]: normalizedIdentifier,
        })
        .select("id")
        .single()

      if (error || !newContact) {
        throw new Error(`Failed to create contact: ${error?.message}`)
      }

      contactId = newContact.id
    }

    // Record the opt-out
    const { data: optOut, error: optOutError } = await supabase
      .from("opt_outs")
      .upsert({
        contact_id: contactId,
        channel: body.channel,
        source: body.source,
        reason: body.reason || null,
        opt_out_date: new Date().toISOString(),
        metadata: body.metadata || null,
      })
      .select()
      .single()

    if (optOutError) {
      throw new Error(`Failed to record opt-out: ${optOutError.message}`)
    }

    // Record compliance event
    await supabase.from("compliance_events").insert({
      event_type: "opt-out",
      status: "pass",
      contact_id: contactId,
      details: {
        channel: body.channel,
        source: body.source,
        reason: body.reason,
      },
    })

    // Log the API request
    const endTime = Date.now()
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/opt-out",
      method: "POST",
      request_data: body,
      response_data: { success: true, optOut },
      status_code: 200,
      latency: endTime - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    // Return success response
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      message: `Successfully opted out ${body.identifier} from ${body.channel} communications`,
      details: {
        identifier: body.identifier,
        channel: body.channel,
        source: body.source,
        reason: body.reason || null,
        metadata: body.metadata || null,
      },
    })
  } catch (error) {
    console.error("Error processing opt-out:", error)

    // Log the error
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/opt-out",
      method: "POST",
      status_code: 500,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
