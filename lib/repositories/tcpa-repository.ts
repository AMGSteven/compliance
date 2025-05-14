import { createClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"

export interface TCPACheckResult {
  id: string
  phone: string
  contactName?: string
  compliant: boolean
  reasons: string[]
  rawResponse?: any
  createdAt: string
  batchId?: string
}

export interface TCPABatchCheck {
  id: string
  totalChecked: number
  compliantCount: number
  nonCompliantCount: number
  hasErrors: boolean
  createdAt: string
  completedAt?: string
  createdBy?: string
  status: "pending" | "processing" | "completed" | "failed"
}

export class TCPARepository {
  /**
   * Creates a new TCPA check result
   */
  async createCheckResult(data: Omit<TCPACheckResult, "id" | "createdAt">): Promise<TCPACheckResult> {
    const supabase = createClient()
    const id = nanoid()
    const createdAt = new Date().toISOString()

    const { data: result, error } = await supabase
      .from("tcpa_check_results")
      .insert({
        id,
        phone: data.phone,
        contact_name: data.contactName,
        compliant: data.compliant,
        reasons: data.reasons,
        raw_response: data.rawResponse,
        created_at: createdAt,
        batch_id: data.batchId,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating TCPA check result:", error)
      throw error
    }

    return {
      id: result.id,
      phone: result.phone,
      contactName: result.contact_name,
      compliant: result.compliant,
      reasons: result.reasons,
      rawResponse: result.raw_response,
      createdAt: result.created_at,
      batchId: result.batch_id,
    }
  }

  /**
   * Creates a new TCPA batch check
   */
  async createBatchCheck(data: Omit<TCPABatchCheck, "id" | "createdAt">): Promise<TCPABatchCheck> {
    const supabase = createClient()
    const id = nanoid()
    const createdAt = new Date().toISOString()

    const { data: result, error } = await supabase
      .from("tcpa_batch_checks")
      .insert({
        id,
        total_checked: data.totalChecked,
        compliant_count: data.compliantCount,
        non_compliant_count: data.nonCompliantCount,
        has_errors: data.hasErrors,
        created_at: createdAt,
        completed_at: data.completedAt,
        created_by: data.createdBy,
        status: data.status,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating TCPA batch check:", error)
      throw error
    }

    return {
      id: result.id,
      totalChecked: result.total_checked,
      compliantCount: result.compliant_count,
      nonCompliantCount: result.non_compliant_count,
      hasErrors: result.has_errors,
      createdAt: result.created_at,
      completedAt: result.completed_at,
      createdBy: result.created_by,
      status: result.status,
    }
  }

  /**
   * Updates a TCPA batch check
   */
  async updateBatchCheck(id: string, data: Partial<Omit<TCPABatchCheck, "id" | "createdAt">>): Promise<TCPABatchCheck> {
    const supabase = createClient()

    const updateData: any = {}
    if (data.totalChecked !== undefined) updateData.total_checked = data.totalChecked
    if (data.compliantCount !== undefined) updateData.compliant_count = data.compliantCount
    if (data.nonCompliantCount !== undefined) updateData.non_compliant_count = data.nonCompliantCount
    if (data.hasErrors !== undefined) updateData.has_errors = data.hasErrors
    if (data.completedAt !== undefined) updateData.completed_at = data.completedAt
    if (data.status !== undefined) updateData.status = data.status

    const { data: result, error } = await supabase
      .from("tcpa_batch_checks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating TCPA batch check:", error)
      throw error
    }

    return {
      id: result.id,
      totalChecked: result.total_checked,
      compliantCount: result.compliant_count,
      nonCompliantCount: result.non_compliant_count,
      hasErrors: result.has_errors,
      createdAt: result.created_at,
      completedAt: result.completed_at,
      createdBy: result.created_by,
      status: result.status,
    }
  }

  /**
   * Gets a TCPA batch check by ID
   */
  async getBatchCheck(id: string): Promise<TCPABatchCheck | null> {
    const supabase = createClient()

    const { data, error } = await supabase.from("tcpa_batch_checks").select().eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      console.error("Error getting TCPA batch check:", error)
      throw error
    }

    return {
      id: data.id,
      totalChecked: data.total_checked,
      compliantCount: data.compliant_count,
      nonCompliantCount: data.non_compliant_count,
      hasErrors: data.has_errors,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      createdBy: data.created_by,
      status: data.status,
    }
  }

  /**
   * Gets TCPA check results by batch ID
   */
  async getCheckResultsByBatchId(batchId: string): Promise<TCPACheckResult[]> {
    const supabase = createClient()

    const { data, error } = await supabase.from("tcpa_check_results").select().eq("batch_id", batchId)

    if (error) {
      console.error("Error getting TCPA check results:", error)
      throw error
    }

    return data.map((result) => ({
      id: result.id,
      phone: result.phone,
      contactName: result.contact_name,
      compliant: result.compliant,
      reasons: result.reasons,
      rawResponse: result.raw_response,
      createdAt: result.created_at,
      batchId: result.batch_id,
    }))
  }

  /**
   * Gets recent TCPA batch checks
   */
  async getRecentBatchChecks(limit = 10): Promise<TCPABatchCheck[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tcpa_batch_checks")
      .select()
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error getting recent TCPA batch checks:", error)
      throw error
    }

    return data.map((result) => ({
      id: result.id,
      totalChecked: result.total_checked,
      compliantCount: result.compliant_count,
      nonCompliantCount: result.non_compliant_count,
      hasErrors: result.has_errors,
      createdAt: result.created_at,
      completedAt: result.completed_at,
      createdBy: result.created_by,
      status: result.status,
    }))
  }

  /**
   * Gets TCPA check results by phone number
   */
  async getCheckResultsByPhone(phone: string, limit = 10): Promise<TCPACheckResult[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("tcpa_check_results")
      .select()
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error getting TCPA check results by phone:", error)
      throw error
    }

    return data.map((result) => ({
      id: result.id,
      phone: result.phone,
      contactName: result.contact_name,
      compliant: result.compliant,
      reasons: result.reasons,
      rawResponse: result.raw_response,
      createdAt: result.created_at,
      batchId: result.batch_id,
    }))
  }

  /**
   * Gets TCPA compliance stats
   */
  async getComplianceStats(days = 30): Promise<{
    totalChecks: number
    compliantCount: number
    nonCompliantCount: number
    complianceRate: number
  }> {
    const supabase = createClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from("tcpa_check_results")
      .select("compliant")
      .gte("created_at", startDate.toISOString())

    if (error) {
      console.error("Error getting TCPA compliance stats:", error)
      throw error
    }

    const totalChecks = data.length
    const compliantCount = data.filter((result) => result.compliant).length
    const nonCompliantCount = totalChecks - compliantCount
    const complianceRate = totalChecks > 0 ? (compliantCount / totalChecks) * 100 : 100

    return {
      totalChecks,
      compliantCount,
      nonCompliantCount,
      complianceRate,
    }
  }
}
