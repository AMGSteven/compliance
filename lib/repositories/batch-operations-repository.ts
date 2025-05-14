import { createClient } from "@/lib/supabase/server"
import { generateId } from "@/lib/utils/api-key"

export type BatchOperation = {
  id: string
  type: string
  status: "pending" | "processing" | "completed" | "failed"
  total_items: number
  processed_items: number
  successful_items: number
  failed_items: number
  created_at: string
  updated_at: string
  completed_at?: string
  created_by: string
  metadata?: any
}

export type BatchOperationResult = {
  id: string
  batch_operation_id: string // Updated to match the database schema
  item_id: string
  success: boolean
  message: string
  data?: any
  created_at: string
}

export class BatchOperationsRepository {
  async create(
    batchOp: Omit<
      BatchOperation,
      "id" | "status" | "processed_items" | "successful_items" | "failed_items" | "created_at" | "updated_at"
    >,
  ): Promise<BatchOperation> {
    const supabase = createClient()
    const now = new Date().toISOString()

    const newBatchOp = {
      id: generateId(),
      status: "pending",
      processed_items: 0,
      successful_items: 0,
      failed_items: 0,
      created_at: now,
      updated_at: now,
      ...batchOp,
    }

    const { data, error } = await supabase.from("batch_operations").insert(newBatchOp).select().single()

    if (error) {
      console.error("Error creating batch operation:", error)
      throw error
    }

    return data as BatchOperation
  }

  async findById(id: string): Promise<BatchOperation | null> {
    const supabase = createClient()
    const { data, error } = await supabase.from("batch_operations").select("*").eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      console.error(`Error finding batch operation with id ${id}:`, error)
      throw error
    }

    return data as BatchOperation
  }

  async findWithResults(id: string): Promise<(BatchOperation & { results: BatchOperationResult[] }) | null> {
    const supabase = createClient()

    // First get the batch operation
    const { data: batchOp, error: batchError } = await supabase
      .from("batch_operations")
      .select("*")
      .eq("id", id)
      .single()

    if (batchError) {
      if (batchError.code === "PGRST116") {
        return null
      }
      console.error(`Error finding batch operation with id ${id}:`, batchError)
      throw batchError
    }

    // Then get the results
    const { data: results, error: resultsError } = await supabase
      .from("batch_operation_results")
      .select("*")
      .eq("batch_operation_id", id) // Updated to match the database schema
      .order("created_at", { ascending: true })

    if (resultsError) {
      console.error(`Error finding batch operation results for batch ${id}:`, resultsError)
      throw resultsError
    }

    return {
      ...(batchOp as BatchOperation),
      results: results as BatchOperationResult[],
    }
  }

  async updateStatus(id: string, updates: Partial<BatchOperation>): Promise<BatchOperation> {
    const supabase = createClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("batch_operations")
      .update({
        ...updates,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating batch operation with id ${id}:`, error)
      throw error
    }

    return data as BatchOperation
  }

  async addResult(
    batchId: string,
    result: Omit<BatchOperationResult, "id" | "batch_operation_id" | "created_at">,
  ): Promise<BatchOperationResult> {
    const supabase = createClient()
    const now = new Date().toISOString()

    const newResult = {
      id: generateId(),
      batch_operation_id: batchId, // Updated to match the database schema
      created_at: now,
      ...result,
    }

    const { data, error } = await supabase.from("batch_operation_results").insert(newResult).select().single()

    if (error) {
      console.error(`Error adding result to batch ${batchId}:`, error)
      throw error
    }

    return data as BatchOperationResult
  }

  async findRecent(limit = 10): Promise<BatchOperation[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("batch_operations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error finding recent batch operations:", error)
      throw error
    }

    return data as BatchOperation[]
  }

  async findByUser(userId: string, limit = 50): Promise<BatchOperation[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("batch_operations")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error(`Error finding batch operations for user ${userId}:`, error)
      throw error
    }

    return data as BatchOperation[]
  }

  async findByType(type: string, limit = 50): Promise<BatchOperation[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("batch_operations")
      .select("*")
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error(`Error finding batch operations of type ${type}:`, error)
      throw error
    }

    return data as BatchOperation[]
  }

  async getResultsByBatchId(batchId: string): Promise<BatchOperationResult[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("batch_operation_results")
      .select("*")
      .eq("batch_operation_id", batchId) // Updated to match the database schema
      .order("created_at", { ascending: true })

    if (error) {
      console.error(`Error getting results for batch ${batchId}:`, error)
      throw error
    }

    return data as BatchOperationResult[]
  }

  async deleteById(id: string): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from("batch_operations").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting batch operation with id ${id}:`, error)
      throw error
    }

    return true
  }

  async countByStatus(): Promise<{
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }> {
    const supabase = createClient()
    const { data, error } = await supabase.from("batch_operations").select("status")

    if (error) {
      console.error("Error counting batch operations by status:", error)
      throw error
    }

    const counts = {
      total: data.length,
      pending: data.filter((op) => op.status === "pending").length,
      processing: data.filter((op) => op.status === "processing").length,
      completed: data.filter((op) => op.status === "completed").length,
      failed: data.filter((op) => op.status === "failed").length,
    }

    return counts
  }
}
