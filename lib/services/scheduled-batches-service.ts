import { ScheduledBatchesRepository } from "@/lib/repositories/scheduled-batches-repository"
import { BatchOperationsService } from "@/lib/services/batch-operations-service"
import type { ScheduledBatch, BatchScheduleHistory } from "@/lib/types/batch"
import { calculateNextRunDate } from "@/lib/utils/cron-utils"

export class ScheduledBatchesService {
  private scheduledBatchesRepo: ScheduledBatchesRepository
  private batchOperationsService: BatchOperationsService

  constructor() {
    this.scheduledBatchesRepo = new ScheduledBatchesRepository()
    this.batchOperationsService = new BatchOperationsService()
  }

  /**
   * Create a new scheduled batch
   */
  async createScheduledBatch(
    scheduledBatch: Omit<ScheduledBatch, "id" | "created_at" | "updated_at">,
  ): Promise<ScheduledBatch> {
    try {
      return await this.scheduledBatchesRepo.create(scheduledBatch)
    } catch (error) {
      console.error("Error creating scheduled batch:", error)
      throw error
    }
  }

  /**
   * Get a scheduled batch by ID
   */
  async getScheduledBatchById(id: string): Promise<ScheduledBatch | null> {
    try {
      return await this.scheduledBatchesRepo.findById(id)
    } catch (error) {
      console.error(`Error getting scheduled batch with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Get scheduled batches by user
   */
  async getScheduledBatchesByUser(userId: string): Promise<ScheduledBatch[]> {
    try {
      return await this.scheduledBatchesRepo.findByUser(userId)
    } catch (error) {
      console.error(`Error getting scheduled batches for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Update a scheduled batch
   */
  async updateScheduledBatch(id: string, updates: Partial<ScheduledBatch>): Promise<ScheduledBatch> {
    try {
      return await this.scheduledBatchesRepo.update(id, updates)
    } catch (error) {
      console.error(`Error updating scheduled batch with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a scheduled batch
   */
  async deleteScheduledBatch(id: string): Promise<boolean> {
    try {
      return await this.scheduledBatchesRepo.delete(id)
    } catch (error) {
      console.error(`Error deleting scheduled batch with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Process due scheduled batches
   */
  async processDueScheduledBatches(): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    try {
      const dueSchedules = await this.scheduledBatchesRepo.findDue()
      let processed = 0
      let succeeded = 0
      let failed = 0

      for (const schedule of dueSchedules) {
        try {
          processed++

          // Execute the batch operation based on the schedule type
          let batchOpId: string | undefined

          if (schedule.type === "trustedform_verification") {
            const batchOp = await this.batchOperationsService.createTrustedFormBatchVerification(
              schedule.configuration.items,
              schedule.created_by,
              {
                ...schedule.configuration.metadata,
                scheduledBatchId: schedule.id,
                scheduledRun: true,
              },
            )
            batchOpId = batchOp.id
          } else {
            throw new Error(`Unsupported scheduled batch type: ${schedule.type}`)
          }

          // Add a success history entry
          await this.scheduledBatchesRepo.addHistoryEntry({
            scheduled_batch_id: schedule.id,
            batch_operation_id: batchOpId,
            status: "success",
          })

          // Update the schedule with the next run date
          const nextRun = calculateNextRunDate(schedule.schedule, schedule.cron_expression)
          await this.scheduledBatchesRepo.update(schedule.id, {
            next_run: nextRun.toISOString(),
            last_run: new Date().toISOString(),
          })

          succeeded++
        } catch (error) {
          console.error(`Error processing scheduled batch ${schedule.id}:`, error)

          // Add a failed history entry
          await this.scheduledBatchesRepo.addHistoryEntry({
            scheduled_batch_id: schedule.id,
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })

          failed++
        }
      }

      return { processed, succeeded, failed }
    } catch (error) {
      console.error("Error processing due scheduled batches:", error)
      throw error
    }
  }

  /**
   * Get history for a scheduled batch
   */
  async getScheduledBatchHistory(scheduleId: string): Promise<BatchScheduleHistory[]> {
    try {
      return await this.scheduledBatchesRepo.getHistoryByScheduleId(scheduleId)
    } catch (error) {
      console.error(`Error getting history for scheduled batch ${scheduleId}:`, error)
      throw error
    }
  }
}
