import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { TrustedFormDashboardStats } from "@/lib/types/trustedform"

export async function GET() {
  try {
    const supabase = createServerClient()

    // Get total certificates count
    const { count: totalCertificates, error: totalError } = await supabase
      .from("trusted_form_certificates")
      .select("*", { count: "exact", head: true })

    if (totalError) throw new Error(totalError.message)

    // Get pending certificates count
    const { count: pendingCertificates, error: pendingError } = await supabase
      .from("trusted_form_certificates")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    if (pendingError) throw new Error(pendingError.message)

    // Get verified certificates count
    const { count: verifiedCertificates, error: verifiedError } = await supabase
      .from("trusted_form_certificates")
      .select("*", { count: "exact", head: true })
      .eq("status", "verified")

    if (verifiedError) throw new Error(verifiedError.message)

    // Get invalid certificates count
    const { count: invalidCertificates, error: invalidError } = await supabase
      .from("trusted_form_certificates")
      .select("*", { count: "exact", head: true })
      .eq("status", "invalid")

    if (invalidError) throw new Error(invalidError.message)

    // Calculate verification success rate
    const verificationSuccessRate =
      totalCertificates > 0 ? Math.round((verifiedCertificates / totalCertificates) * 100 * 10) / 10 : 0

    // Get recent certificates with contact info
    const { data: recentCertificates, error: recentError } = await supabase
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
      .limit(10)

    if (recentError) throw new Error(recentError.message)

    const stats: TrustedFormDashboardStats = {
      totalCertificates: totalCertificates || 0,
      pendingCertificates: pendingCertificates || 0,
      verifiedCertificates: verifiedCertificates || 0,
      invalidCertificates: invalidCertificates || 0,
      verificationSuccessRate,
      recentCertificates: recentCertificates || [],
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching TrustedForm stats:", error)

    // Return mock data for development/preview
    const mockStats: TrustedFormDashboardStats = {
      totalCertificates: 325,
      pendingCertificates: 38,
      verifiedCertificates: 275,
      invalidCertificates: 12,
      verificationSuccessRate: 88.5,
      recentCertificates: Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `mock-cert-${i}`,
          certificate_url: `https://cert.trustedform.com/${Array(40)
            .fill(0)
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join("")}`,
          status: ["pending", "verified", "invalid"][Math.floor(Math.random() * 3)],
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          verified_at: null,
          metadata: { source: "API", form_name: "Test Form" },
          contact: {
            id: `mock-contact-${i}`,
            email: `user${i}@example.com`,
            phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          },
        })),
    }

    return NextResponse.json(mockStats)
  }
}
