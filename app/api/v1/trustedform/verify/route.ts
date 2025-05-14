import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { TrustedFormService } from "@/lib/services/trustedform-service"

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createServerClient()

  try {
    const body = await request.json()

    // Validate request
    if (!body.certificateId && !body.certificateUrl) {
      return NextResponse.json({ error: "Either certificateId or certificateUrl is required" }, { status: 400 })
    }

    let certificateId = body.certificateId
    let certificateUrl = body.certificateUrl
    let contactId: string | null = null

    // If certificateId is provided, fetch the certificate
    if (certificateId) {
      const { data: certificate, error } = await supabase
        .from("trusted_form_certificates")
        .select("certificate_url, contact_id")
        .eq("id", certificateId)
        .single()

      if (error || !certificate) {
        return NextResponse.json({ error: "Certificate not found" }, { status: 404 })
      }

      certificateUrl = certificate.certificate_url
      contactId = certificate.contact_id
    } else if (certificateUrl) {
      // Check if the certificate already exists
      const { data: existingCert } = await supabase
        .from("trusted_form_certificates")
        .select("id, contact_id")
        .eq("certificate_url", certificateUrl)
        .maybeSingle()

      if (existingCert) {
        certificateId = existingCert.id
        contactId = existingCert.contact_id
      }
    }

    // If we don't have a contact ID yet, we need to create a new certificate
    if (!contactId) {
      if (!body.contactData || (!body.contactData.email && !body.contactData.phone)) {
        return NextResponse.json(
          { error: "Contact data with email or phone is required for new certificates" },
          { status: 400 },
        )
      }

      // Check if contact exists, create if not
      const { email, phone } = body.contactData

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
            })
            .select("id")
            .single()

          if (error || !newContact) {
            throw new Error(`Failed to create contact: ${error?.message}`)
          }

          contactId = newContact.id
        }
      }

      // If we still don't have a certificate ID, create a new certificate
      if (!certificateId && contactId) {
        const { data: newCert, error } = await supabase
          .from("trusted_form_certificates")
          .insert({
            certificate_url: certificateUrl,
            contact_id: contactId,
            status: "pending",
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (error || !newCert) {
          throw new Error(`Failed to create certificate: ${error?.message}`)
        }

        certificateId = newCert.id
      }
    }

    // Get contact data for verification
    const { data: contact } = await supabase.from("contacts").select("email, phone").eq("id", contactId).single()

    // Prepare lead data for verification
    const leadData = {
      email: body.contactData?.email || contact?.email,
      phone: body.contactData?.phone || contact?.phone,
    }

    // Verify the certificate with TrustedForm
    const verifyResult = await TrustedFormService.verifyCertificate({
      certificateUrl,
      leadData,
      referenceId: certificateId,
      vendor: body.vendor || "SuppressionEngine",
    })

    // Determine match status
    const matchStatus =
      verifyResult.success &&
      verifyResult.certificate?.matching &&
      (verifyResult.certificate.matching.email || verifyResult.certificate.matching.phone)

    // Store verification result
    const { data: verification, error: verificationError } = await supabase
      .from("certificate_verifications")
      .insert({
        certificate_id: certificateId,
        verification_result: verifyResult,
        match_status: !!matchStatus,
        verified_at: new Date().toISOString(),
        verified_by: body.verifiedBy || "API",
      })
      .select()
      .single()

    if (verificationError) {
      throw new Error(`Failed to store verification: ${verificationError.message}`)
    }

    // Update certificate status
    const newStatus = verifyResult.success ? (matchStatus ? "verified" : "invalid") : "invalid"
    await supabase
      .from("trusted_form_certificates")
      .update({
        status: newStatus,
        verified_at: new Date().toISOString(),
        expires_at: verifyResult.certificate?.expires_at,
        metadata: {
          ...(await supabase
            .from("trusted_form_certificates")
            .select("metadata")
            .eq("id", certificateId)
            .single()
            .then((res) => res.data?.metadata || {})),
          verification_id: verification.id,
          page_url: verifyResult.certificate?.page_url,
          ip: verifyResult.certificate?.ip,
          geo: verifyResult.certificate?.geo,
          warnings: verifyResult.certificate?.warnings || verifyResult.warnings,
          errors: verifyResult.errors,
        },
      })
      .eq("id", certificateId)

    // Record compliance event
    await supabase.from("compliance_events").insert({
      event_type: "validation",
      status: verifyResult.success ? (matchStatus ? "pass" : "warning") : "fail",
      contact_id: contactId,
      details: {
        type: "trustedform_verification",
        certificate_id: certificateId,
        verification_id: verification.id,
        match_status: matchStatus,
        success: verifyResult.success,
      },
    })

    // Log the API request
    const endTime = Date.now()
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/trustedform/verify",
      method: "POST",
      request_data: body,
      response_data: {
        success: verifyResult.success,
        certificateId,
        verificationId: verification.id,
        status: newStatus,
        matchStatus,
      },
      status_code: 200,
      latency: endTime - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    // Return success response
    return NextResponse.json({
      success: verifyResult.success,
      certificateId,
      verificationId: verification.id,
      status: newStatus,
      matchStatus,
      details: verifyResult.certificate,
      warnings: verifyResult.warnings,
      errors: verifyResult.errors,
    })
  } catch (error) {
    console.error("Error verifying TrustedForm certificate:", error)

    // Log the error
    await supabase.from("api_requests").insert({
      endpoint: "/api/v1/trustedform/verify",
      method: "POST",
      status_code: 500,
      latency: Date.now() - startTime,
      ip_address: request.headers.get("x-forwarded-for") || request.ip,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
