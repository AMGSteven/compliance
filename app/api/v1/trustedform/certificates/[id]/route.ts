import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const certificateId = params.id

  try {
    // Fetch the certificate with contact and verifications
    const { data: certificate, error } = await supabase
      .from("trusted_form_certificates")
      .select(
        `
        *,
        contact:contact_id (
          id, email, phone
        ),
        verifications:certificate_verifications (
          id, verification_result, match_status, verified_at, verified_by
        )
      `,
      )
      .eq("id", certificateId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Certificate not found" }, { status: 404 })
      }
      throw new Error(`Failed to fetch certificate: ${error.message}`)
    }

    // Return the certificate
    return NextResponse.json({
      certificate,
    })
  } catch (error) {
    console.error("Error fetching TrustedForm certificate:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
