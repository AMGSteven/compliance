import { createServerClient } from "@/lib/supabase/server"
import { generateId } from "@/lib/utils/api-key"
import type { ScheduledBatch, BatchScheduleHistory } from "@/lib/types/batch"

export class ScheduledBatchesRepository {
  async create(scheduledBatch: Omit<ScheduledBatch, "id" | "created_at" | "updated_at">): Promise<ScheduledBatch> {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const newScheduledBatch = {
      id: generateId(),
      created_at: now,
      updated_at: now,
      ...scheduledBatch,
    }

    const { data, error } = await supabase.from("scheduled_batches").insert(newScheduledBatch).select().single()

    if (error) {
      console.error("Error creating scheduled batch:", error)
      throw error
    }

    return data as ScheduledBatch
  }

  async findById(id: string): Promise<ScheduledBatch | null> {
    const supabase = createServerClient()
    const { data, error } = await supabase.from("scheduled_batches").select("*").eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      console.error(`Error finding scheduled batch with id ${id}:`, error)
      throw error
    }

    return data as ScheduledBatch
  }

  async findByUser(userId: string): Promise<ScheduledBatch[]> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("scheduled_batches")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(`Error finding scheduled batches for user ${userId}:`, error)
      throw error
    }

    return data as ScheduledBatch[]
  }

  async findActive(): Promise<ScheduledBatch[]> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("scheduled_batches")
      .select("*")
      .eq("status", "active")
      .order("next_run", { ascending: true })

    if (error) {
      console.error("Error finding active scheduled batches:", error)
      throw error
    }

    return data as ScheduledBatch[]
  }

  async findDue(): Promise<ScheduledBatch[]> {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("scheduled_batches")
      .select("*")
      .eq("status", "active")
      .lte("next_run", now)
      .order("next_run", { ascending: true })

    if (error) {
      console.error("Error finding due scheduled batches:", error)
      throw error
    }

    return data as ScheduledBatch[]
  }

  async update(id: string, updates: Partial<ScheduledBatch>): Promise<ScheduledBatch> {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("scheduled_batches")
      .update({
        ...updates,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error(`Error updating scheduled batch with id ${id}:`, error)
      throw error
    }

    return data as ScheduledBatch
  }

  async delete(id: string): Promise<boolean> {
    const supabase = createServerClient()
    const { error } = await supabase.from("scheduled_batches").delete().eq("id", id)

    if (error) {
      console.error(`Error deleting scheduled batch with id ${id}:`, error)
      throw error
    }

    return true
  }

  async addHistoryEntry(entry: Omit<BatchScheduleHistory, "id" | "run_at">): Promise<BatchScheduleHistory> {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const newEntry = {
      id: generateId(),
      run_at: now,
      ...entry,
    }

    const { data, error } = await supabase.from("batch_schedule_history").insert(newEntry).select().single()

    if (error) {
      console.error("Error adding batch schedule history entry:", error)
      throw error
    }

    return data as BatchScheduleHistory
  }

  async getHistoryByScheduleId(scheduleId: string): Promise<BatchScheduleHistory[]> {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("batch_schedule_history")
      .select("*")
      .eq("scheduled_batch_id", scheduleId)
      .order("run_at", { ascending: false })

    if (error) {
      console.error(`Error getting history for scheduled batch ${scheduleId}:`, error)
      throw error
    }

    return data as BatchScheduleHistory[]
  }
}
