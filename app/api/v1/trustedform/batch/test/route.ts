import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { BatchOperationsRepository } from "@/lib/repositories/batch-operations-repository"

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse the request body
    const body = await request.json()
    const { certificates, successRate = 80 } = body

    if (!certificates || !Array.isArray(certificates) || certificates.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Certificates array is required and must not be empty." },
        { status: 400 },
      )
    }

    // Create a new batch operation
    const batchRepo = new BatchOperationsRepository()
    const batchOp = await batchRepo.create({
      type: "trustedform_verification",
      total_items: certificates.length,
      created_by: user.id,
      metadata: {
        isTest: true,
        successRate,
      },
    })

    // Process the batch asynchronously
    processMockBatch(batchOp.id, certificates, successRate).catch((error) => {
      console.error(`Error processing mock batch ${batchOp.id}:`, error)
    })

    return NextResponse.json({
      batchId: batchOp.id,
      status: batchOp.status,
      totalItems: batchOp.total_items,
    })
  } catch (error) {
    console.error("Error creating test batch:", error)
    return NextResponse.json({ error: "Failed to create test batch" }, { status: 500 })
  }
}

async function processMockBatch(batchId: string, certificates: any[], successRate: number) {
  try {
    const batchRepo = new BatchOperationsRepository()

    // Update batch status to processing
    await batchRepo.updateStatus(batchId, {
      status: "processing",
    })

    let processedItems = 0
    let successfulItems = 0
    let failedItems = 0

    // Process each certificate with a delay to simulate real processing
    for (const cert of certificates) {
      // Determine if this certificate will succeed based on the success rate
      const willSucceed = Math.random() * 100 < successRate

      // Add a small delay to simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Add the result to the batch
      await batchRepo.addResult(batchId, {
        item_id: cert.certificateId || cert.certificateUrl,
        success: willSucceed,
        message: willSucceed
          ? "Certificate verified successfully"
          : "Certificate verification failed: Invalid certificate",
        data: willSucceed
          ? {
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              warnings: [],
              fingerprints: {
                matching: [],
                non_matching: [],
              },
              scan_results: {
                found: [cert.leadData.email, cert.leadData.phone],
                not_found: [],
              },
            }
          : {
              error: "Certificate not found or invalid",
            },
      })

      // Update counters
      processedItems++
      if (willSucceed) {
        successfulItems++
      } else {
        failedItems++
      }

      // Update batch status periodically
      if (processedItems % 5 === 0 || processedItems === certificates.length) {
        await batchRepo.updateStatus(batchId, {
          processed_items: processedItems,
          successful_items: successfulItems,
          failed_items: failedItems,
        })
      }
    }

    // Update batch status to completed
    await batchRepo.updateStatus(batchId, {
      status: "completed",
      processed_items: processedItems,
      successful_items: successfulItems,
      failed_items: failedItems,
      completed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error(`Error processing mock batch ${batchId}:`, error)

    // Update batch status to failed
    const batchRepo = new BatchOperationsRepository()
    await batchRepo.updateStatus(batchId, {
      status: "failed",
      completed_at: new Date().toISOString(),
    })
  }
}
