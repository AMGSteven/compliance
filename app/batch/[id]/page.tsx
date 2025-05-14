"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { BatchResults } from "@/components/batch/batch-results"

export default function BatchDetailPage() {
  const params = useParams()
  const batchId = params.id as string

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/batch">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batch Operation Details</h1>
          <p className="text-muted-foreground">View the results of this batch operation</p>
        </div>
      </div>

      <BatchResults batchId={batchId} />
    </div>
  )
}
