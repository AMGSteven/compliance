import { TrustedFormRepository } from "@/lib/repositories/trusted-form-repository"
import { triggerWebhook } from "@/lib/utils/webhook-trigger"
import { BatchOperationsRepository } from "@/lib/repositories/batch-operations-repository"

export class TrustedFormService {
  private trustedFormRepo: TrustedFormRepository
  private batchRepo: BatchOperationsRepository

  constructor() {
    this.trustedFormRepo = new TrustedFormRepository()
    this.batchRepo = new BatchOperationsRepository()
  }

  async verifyCertificate(data: {
    certificateUrl: string
    leadData?: any
    referenceId?: string
    vendor?: string
  }) {
    try {
      if (!process.env.TRUSTEDFORM_API_KEY) {
        throw new Error("TrustedForm API key is not configured")
      }

      const apiKey = process.env.TRUSTEDFORM_API_KEY

      // Make request to TrustedForm API
      const response = await fetch(data.certificateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          reference: data.referenceId || `suppression-engine-${Date.now()}`,
          vendor: data.vendor || "SuppressionEngine",
          email: data.leadData?.email,
          phone_1: data.leadData?.phone,
          first_name: data.leadData?.firstName,
          last_name: data.leadData?.lastName,
        }),
      })

      const responseData = await response.json()

      // Extract certificate ID from URL
      const certificateId = data.certificateUrl.split("/").pop() || ""

      // Store the certificate in the database
      const certificate = await this.trustedFormRepo.createOrUpdateCertificate({
        id: certificateId,
        certificate_url: data.certificateUrl,
        status: response.ok ? "verified" : "invalid",
        response_data: responseData,
        reference_id: data.referenceId,
        vendor: data.vendor,
        lead_data: data.leadData,
        verified_at: response.ok ? new Date().toISOString() : null,
      })

      // Trigger webhook for certificate verification
      await triggerWebhook("trustedform.certificate.verified", {
        certificateId,
        success: response.ok,
        timestamp: new Date().toISOString(),
        data: responseData,
      })

      return {
        success: response.ok,
        certificate: responseData,
        errors: response.ok ? [] : [responseData.message || "Verification failed"],
      }
    } catch (error) {
      console.error("Error verifying TrustedForm certificate:", error)
      return {
        success: false,
        certificate: null,
        errors: [(error as Error).message],
      }
    }
  }

  async getCertificateById(id: string) {
    return this.trustedFormRepo.findById(id)
  }

  async getAllCertificates(limit = 100, offset = 0) {
    return this.trustedFormRepo.findAll(limit, offset)
  }

  async searchCertificates(query: string, limit = 100, offset = 0) {
    return this.trustedFormRepo.search(query, limit, offset)
  }

  async getDashboardStats() {
    const totalCertificates = await this.trustedFormRepo.countAll()
    const verifiedCertificates = await this.trustedFormRepo.countByStatus("verified")
    const pendingCertificates = await this.trustedFormRepo.countByStatus("pending")
    const invalidCertificates = await this.trustedFormRepo.countByStatus("invalid")
    const recentCertificates = await this.trustedFormRepo.findRecent(6)

    const verificationSuccessRate =
      totalCertificates > 0
        ? Math.round((verifiedCertificates / (verifiedCertificates + invalidCertificates)) * 100)
        : 0

    return {
      totalCertificates,
      verifiedCertificates,
      pendingCertificates,
      invalidCertificates,
      verificationSuccessRate,
      recentCertificates,
    }
  }

  async createBatchVerification(
    items: Array<{ certificateUrl?: string; certificateId?: string; leadData?: any }>,
    userId: string,
    metadata: any = {},
  ) {
    try {
      // Create the batch operation
      const batchOp = await this.batchRepo.create({
        type: "trustedform_verification",
        total_items: items.length,
        created_by: userId,
        metadata,
      })

      // Start processing the batch asynchronously
      this.processBatchVerification(batchOp.id, items, metadata).catch((error) => {
        console.error(`Error processing batch verification ${batchOp.id}:`, error)
      })

      return {
        batchId: batchOp.id,
        status: batchOp.status,
        totalItems: batchOp.total_items,
      }
    } catch (error) {
      console.error("Error creating TrustedForm batch verification:", error)
      throw error
    }
  }

  private async processBatchVerification(
    batchId: string,
    items: Array<{ certificateUrl?: string; certificateId?: string; leadData?: any }>,
    metadata: any = {},
  ) {
    try {
      // Update batch status to processing
      await this.batchRepo.updateStatus(batchId, {
        status: "processing",
      })

      let processedItems = 0
      let successfulItems = 0
      let failedItems = 0

      // Process each item in the batch
      for (const item of items) {
        try {
          // Skip items without a certificate URL or ID
          if (!item.certificateUrl && !item.certificateId) {
            await this.batchRepo.addResult(batchId, {
              item_id: `item-${processedItems}`,
              success: false,
              message: "Missing certificate URL or ID",
            })
            processedItems++
            failedItems++
            continue
          }

          // Get certificate URL
          let certificateUrl = item.certificateUrl
          if (!certificateUrl && item.certificateId) {
            certificateUrl = `https://cert.trustedform.com/${item.certificateId}`
          }

          // Verify the certificate
          const verifyResult = await this.verifyCertificate({
            certificateUrl: certificateUrl!,
            leadData: item.leadData || {},
            referenceId: metadata.referenceId || `batch-${batchId}-item-${processedItems}`,
            vendor: metadata.vendor || "SuppressionEngine",
          })

          // Add the result to the batch
          await this.batchRepo.addResult(batchId, {
            item_id: item.certificateId || certificateUrl || `item-${processedItems}`,
            success: verifyResult.success,
            message: verifyResult.success
              ? "Certificate verified successfully"
              : verifyResult.errors?.join(", ") || "Verification failed",
            data: verifyResult.certificate,
          })

          // Update counters
          processedItems++
          if (verifyResult.success) {
            successfulItems++
          } else {
            failedItems++
          }

          // Update batch status periodically
          if (processedItems % 5 === 0 || processedItems === items.length) {
            await this.batchRepo.updateStatus(batchId, {
              processed_items: processedItems,
              successful_items: successfulItems,
              failed_items: failedItems,
            })
          }
        } catch (itemError) {
          console.error(`Error processing batch item:`, itemError)

          // Add the error result to the batch
          await this.batchRepo.addResult(batchId, {
            item_id: item.certificateId || item.certificateUrl || `item-${processedItems}`,
            success: false,
            message: (itemError as Error).message,
          })

          // Update counters
          processedItems++
          failedItems++
        }
      }

      // Update batch status to completed
      await this.batchRepo.updateStatus(batchId, {
        status: "completed",
        processed_items: processedItems,
        successful_items: successfulItems,
        failed_items: failedItems,
        completed_at: new Date().toISOString(),
      })

      // Trigger webhook for batch completion
      await triggerWebhook("batch.completed", {
        batchId,
        type: "trustedform_verification",
        totalItems: items.length,
        successfulItems,
        failedItems,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error(`Error processing batch verification ${batchId}:`, error)

      // Update batch status to failed
      await this.batchRepo.updateStatus(batchId, {
        status: "failed",
        completed_at: new Date().toISOString(),
      })
    }
  }

  async getBatchVerification(batchId: string) {
    try {
      const batch = await this.batchRepo.findWithResults(batchId)
      if (!batch) {
        return null
      }

      return {
        batchId: batch.id,
        status: batch.status,
        totalItems: batch.total_items,
        processedItems: batch.processed_items,
        successfulItems: batch.successful_items,
        failedItems: batch.failed_items,
        createdAt: batch.created_at,
        completedAt: batch.completed_at,
        results: batch.results.map((result) => ({
          certificateId: result.item_id,
          success: result.success,
          message: result.message,
          status: result.success ? "verified" : "invalid",
          data: result.data,
        })),
      }
    } catch (error) {
      console.error(`Error getting batch verification ${batchId}:`, error)
      throw error
    }
  }
}
