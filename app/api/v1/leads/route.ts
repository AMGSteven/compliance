import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trustedform-service"

// API key validation middleware
const validateApiKey = (request: NextRequest) => {
  const apiKey = request.headers.get("Api-Key")

  // In a real implementation, you would validate this against stored API keys
  // For now, we'll use a simple check
  const validApiKeys = [
    "YOUR_API_KEY", // Replace with your actual API keys
    "ANOTHER_API_KEY",
  ]

  return validApiKeys.includes(apiKey || "")
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createServerClient()

  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate request
    if (!body.certificateUrl) {
      return NextResponse.json({ error: "TrustedForm certificate URL is required" }, { status: 400 })
    }

    if (!body.email && !body.phone) {
      return NextResponse.json({ error: "Either email or phone is required" }, { status: 400 })
    }

    // Validate certificate URL format
    if (!TrustedFormService.isValidCertificateUrl(body.certificateUrl)) {
      return NextResponse.json({ error: "Invalid TrustedForm certificate URL format" }, { status: 400 })
    }

    // Check if contact exists, create if not
    let contactId: string
    const { email, phone, firstName, lastName } = body

    if (email) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle()

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Create new contact
        const { data: newContact, error } = await supabase
          .from("contacts")
          .insert({
            email: email.toLowerCase(),
            phone,
            first_name: firstName,
            last_name: lastName,
          })
          .select("id")
          .single()

        if (error || !newContact) {
          throw new Error(`Failed to create contact: ${error?.message}`)
        }

        contactId = newContact.id
      }
    } else if (phone) {
      const { data: existingContact } = await supabase.from("contacts").select("id").eq("phone", phone).maybeSingle()

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Create new contact
        const { data: newContact, error } = await supabase
          .from("contacts")
          .insert({
            phone,
            first_name: firstName,
            last_name: lastName,
          })
          .select("id")
          .single()

        if (error || !newContact) {
          throw new Error(`Failed to create contact: ${error?.message}`)
        }

        contactId = newContact.id
      }
    } else {
      return NextResponse.json(
        { error: "Either email or phone is required for contact identification" },
        { status: 400 },
      )
    }

    // Store the certificate
    const { data: certificate, error: certError } = await supabase
      .from("trusted_form_certificates")
      .insert({
        certificate_url: body.certificateUrl,
        contact_id: contactId,
        status: "pending",
        created_at: new Date().toISOString(),
        metadata: {
          source: body.source || body.formName || "External Form",
          form_name: body.formName || "Unknown",
          user_agent: request.headers.get("user-agent"),
          ip_address: request.headers.get("x-forwarded-for") || request.ip,
          domain: new URL(body.source || "https://unknown.com").hostname,
        },
      })
      .select()
      .single()

    if (certError) {
      throw new Error(`Failed to store certificate: ${certError.message}`)
    }

    // Record compliance event
    await supabase.from("compliance_events").insert({
      event_type: "validation",
      status: "pass",
      contact_id: contactId,
      details: {
        type: "trustedform_capture",
        certificate_url: body.certificateUrl,
        source: body.source || body.formName || "External Form",
      },
    })

    // Optionally trigger immediate verification
    let verificationResult = null
    if (body.verifyImmediately) {
      try {
        // Prepare lead data for verification
        const leadData = {
          email: email,
          phone: phone,
        }

        // Verify the certificate with TrustedForm
        const verifyResult = await TrustedFormService.verifyCertificate({
          certificateUrl: body.certificateUrl,
          leadData,
          referenceId: certificate.id,
          vendor: body.source || "External Form",
        })

        // Determine match status
        const matchStatus =
          verifyResult.success &&
          verifyResult.certificate?.matching &&
          (verifyResult.certificate.matching.email || verifyResult.certificate.matching.phone)

        // Store verification result
        const { data: verification } = await supabase
          .from("certificate_verifications")
          .insert({
            certificate_id: certificate.id,
            verification_result: verifyResult,
            match_status: !!matchStatus,
            verified_at: new Date().toISOString(),
            verified_by: "API - Immediate",
          })
          .select()
          .single()

        // Update certificate status
        const newStatus = verifyResult.success ? (matchStatus ? "verified" : "invalid") : "invalid"
        await supabase
          .from("trusted_form_certificates")
          .update({
            status: newStatus,
            verified_at: new Date().toISOString(),
            expires_at: verifyResult.certificate?.expires_at,
            metadata: {
              ...certificate.metadata,
              verification_id: verification.id,
              page_url: verifyResult.certificate?.page_url,
              ip: verifyResult.certificate?.ip,
              geo: verifyResult.certificate?.geo,
              warnings: verifyResult.certificate?.warnings || verifyResult.warnings,
              errors: verifyResult.errors,
            },
          })
          .eq("id", certificate.id)

        verificationResult = {
          success: verifyResult.success,
          status: newStatus,
          matchStatus,
        }
      } catch (verifyError) {
        console.error("Error during immediate verification:", verifyError)
        // Don't fail the whole request if verification fails
        verificationResult = {
          success: false,
          error: "Verification failed",
        }
      }
    }

    // Log the API request
    const endTime = Date.now()
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/leads",
      method: "POST",
      request_data: body,
      response_data: { success: true, certificate, verificationResult },
      status_code: 200,
      latency: endTime - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    // Return success response
    return NextResponse.json({
      success: true,
      message: "Lead and TrustedForm certificate captured successfully",
      certificateId: certificate.id,
      status: certificate.status,
      verificationResult,
    })
  } catch (error) {
    console.error("Error capturing lead data:", error)

    // Log the error
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/leads",
      method: "POST",
      status_code: 500,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
