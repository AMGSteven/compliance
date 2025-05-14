import { BatchOperationsRepository } from "@/lib/repositories/batch-operations-repository"
import { TrustedFormService } from "@/lib/services/trusted-form-service"
import { generateId } from "@/lib/utils/api-key"
import type { BatchOperation, BatchOperationResult } from "@/lib/types/batch"

export class BatchOperationsService {
  private batchOperationsRepo: BatchOperationsRepository
  private trustedFormService: TrustedFormService

  constructor() {
    this.batchOperationsRepo = new BatchOperationsRepository()
    this.trustedFormService = new TrustedFormService()
  }

  /**
   * Create a new TrustedForm batch verification operation
   */
  async createTrustedFormBatchVerification(
    items: { certificateId: string; leadId?: string }[],
    userId: string,
    metadata?: any,
  ): Promise<BatchOperation> {
    try {
      // Create a new batch operation
      const batchOperation = await this.batchOperationsRepo.create({
        type: "trustedform_verification",
        status: "pending",
        total_items: items.length,
        processed_items: 0,
        successful_items: 0,
        failed_items: 0,
        created_by: userId,
        metadata,
      })

      // Process the batch asynchronously
      this.processTrustedFormBatch(batchOperation.id, items).catch((error) => {
        console.error(`Error processing TrustedForm batch ${batchOperation.id}:`, error)
      })

      return batchOperation
    } catch (error) {
      console.error("Error creating TrustedForm batch verification:", error)
      throw error
    }
  }

  /**
   * Process a TrustedForm batch verification operation
   */
  private async processTrustedFormBatch(
    batchId: string,
    items: { certificateId: string; leadId?: string }[],
  ): Promise<void> {
    try {
      // Update batch status to processing
      await this.batchOperationsRepo.update(batchId, {
        status: "processing",
      })

      let processed = 0
      let successful = 0
      let failed = 0

      // Process each item in the batch
      for (const item of items) {
        try {
          // Verify the certificate
          const result = await this.trustedFormService.verifyCertificate(item.certificateId, item.leadId)

          // Create a batch result
          await this.batchOperationsRepo.createResult({
            batch_operation_id: batchId,
            item_id: item.certificateId,
            success: true,
            message: "Certificate verified successfully",
            data: result,
          })

          processed++
          successful++
        } catch (error) {
          // Create a failed batch result
          await this.batchOperationsRepo.createResult({
            batch_operation_id: batchId,
            item_id: item.certificateId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
            data: { error: error instanceof Error ? error.message : "Unknown error" },
          })

          processed++
          failed++
        }

        // Update batch progress
        await this.batchOperationsRepo.update(batchId, {
          processed_items: processed,
          successful_items: successful,
          failed_items: failed,
        })
      }

      // Update batch status to completed
      await this.batchOperationsRepo.update(batchId, {
        status: "completed",
        completed_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error(`Error processing TrustedForm batch ${batchId}:`, error)

      // Update batch status to failed
      await this.batchOperationsRepo.update(batchId, {
        status: "failed",
      })

      throw error
    }
  }

  /**
   * Get a batch operation by ID
   */
  async getBatchOperation(id: string): Promise<BatchOperation | null> {
    try {
      return await this.batchOperationsRepo.findById(id)
    } catch (error) {
      console.error(`Error getting batch operation with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Get batch operations by user
   */
  async getBatchOperationsByUser(userId: string): Promise<BatchOperation[]> {
    try {
      return await this.batchOperationsRepo.findByUser(userId)
    } catch (error) {
      console.error(`Error getting batch operations for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get batch operation results
   */
  async getBatchOperationResults(batchId: string): Promise<BatchOperationResult[]> {
    try {
      return await this.batchOperationsRepo.findResultsByBatchId(batchId)
    } catch (error) {
      console.error(`Error getting results for batch operation ${batchId}:`, error)
      throw error
    }
  }

  /**
   * Create a test batch operation
   */
  async createTestBatch(
    numItems: number,
    successRate: number,
    userId: string,
    metadata?: any,
  ): Promise<BatchOperation> {
    try {
      // Create a new batch operation
      const batchOperation = await this.batchOperationsRepo.create({
        type: "test",
        status: "pending",
        total_items: numItems,
        processed_items: 0,
        successful_items: 0,
        failed_items: 0,
        created_by: userId,
        metadata: { ...metadata, successRate },
      })

      // Process the test batch asynchronously
      this.processTestBatch(batchOperation.id, numItems, successRate).catch((error) => {
        console.error(`Error processing test batch ${batchOperation.id}:`, error)
      })

      return batchOperation
    } catch (error) {
      console.error("Error creating test batch:", error)
      throw error
    }
  }

  /**
   * Process a test batch operation
   */
  private async processTestBatch(batchId: string, numItems: number, successRate: number): Promise<void> {
    try {
      // Update batch status to processing
      await this.batchOperationsRepo.update(batchId, {
        status: "processing",
      })

      let processed = 0
      let successful = 0
      let failed = 0

      // Process each item in the batch
      for (let i = 0; i < numItems; i++) {
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Determine if this item should succeed based on success rate
        const shouldSucceed = Math.random() * 100 <= successRate

        if (shouldSucceed) {
          // Create a successful batch result
          await this.batchOperationsRepo.createResult({
            batch_operation_id: batchId,
            item_id: generateId(),
            success: true,
            message: "Test item processed successfully",
            data: { timestamp: new Date().toISOString(), index: i },
          })

          processed++
          successful++
        } else {
          // Create a failed batch result
          await this.batchOperationsRepo.createResult({
            batch_operation_id: batchId,
            item_id: generateId(),
            success: false,
            message: "Test item processing failed",
            data: { timestamp: new Date().toISOString(), index: i, error: "Simulated failure" },
          })

          processed++
          failed++
        }

        // Update batch progress
        await this.batchOperationsRepo.update(batchId, {
          processed_items: processed,
          successful_items: successful,
          failed_items: failed,
        })
      }

      // Update batch status to completed
      await this.batchOperationsRepo.update(batchId, {
        status: "completed",
        completed_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error(`Error processing test batch ${batchId}:`, error)

      // Update batch status to failed
      await this.batchOperationsRepo.update(batchId, {
        status: "failed",
      })

      throw error
    }
  }
}
