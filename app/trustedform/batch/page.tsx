

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { BatchOperationsList } from "@/components/batch/batch-operations-list"
import { BatchVerificationForm } from "@/components/trustedform/batch-verification-form"
import { useRouter } from "next/navigation"

export default function BatchOperationsPage() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  const handleSuccess = (batchId: string) => {
    router.push(`/trustedform/batch/${batchId}`)
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TrustedForm Batch Operations</h1>
            <p className="text-muted-foreground">Process multiple TrustedForm certificates at once</p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Batch Verification
          </Button>
        )}
      </div>

      {showForm ? (
        <div className="mb-6">
          <BatchVerificationForm onSuccess={handleSuccess} />
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <BatchOperationsList
          type="trustedform_verification"
          title="TrustedForm Batch Operations"
          description="View and manage your TrustedForm batch verification operations"
        />
      )}
    </div>
  )
}
