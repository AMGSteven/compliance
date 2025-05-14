import { BaseRepository } from "./base-repository"
import type { TrustedFormCertificate } from "@/lib/types/trustedform"

export class TrustedFormRepository extends BaseRepository<TrustedFormCertificate> {
  constructor() {
    super("trusted_form_certificates")
  }

  async findByCertificateUrl(url: string): Promise<TrustedFormCertificate | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("certificate_url", url)
        .maybeSingle()

      if (error) throw error
      return data as TrustedFormCertificate
    } catch (error) {
      console.error("Error finding certificate by URL:", error)
      return null
    }
  }

  async findWithContact(certificateId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          contact:contact_id (
            id, email, phone, postal, first_name, last_name
          )
        `)
        .eq("id", certificateId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error finding certificate with contact:", error)
      return null
    }
  }

  async findWithVerifications(certificateId: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          contact:contact_id (
            id, email, phone, postal, first_name, last_name
          ),
          verifications:certificate_verifications (
            id, verification_result, match_status, verified_at, verified_by
          )
        `)
        .eq("id", certificateId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error finding certificate with verifications:", error)
      return null
    }
  }

  async findRecentWithContacts(limit = 10): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          contact:contact_id (
            id, email, phone, postal, first_name, last_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error finding recent certificates with contacts:", error)
      return []
    }
  }

  async countByStatus(): Promise<Record<string, number>> {
    try {
      const statuses = ["pending", "verified", "invalid", "expired"]
      const counts: Record<string, number> = {}

      for (const status of statuses) {
        const { count, error } = await this.supabase
          .from(this.tableName)
          .select("*", { count: "exact", head: true })
          .eq("status", status)

        if (error) throw error
        counts[status] = count || 0
      }

      // Get total count
      const { count: total, error: totalError } = await this.supabase
        .from(this.tableName)
        .select("*", { count: "exact", head: true })

      if (totalError) throw totalError
      counts.total = total || 0

      return counts
    } catch (error) {
      console.error("Error counting certificates by status:", error)
      return { pending: 0, verified: 0, invalid: 0, expired: 0, total: 0 }
    }
  }
}
