"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ArrowRight } from "lucide-react"
import { BatchStatusBadge } from "@/components/batch/batch-status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

interface BatchOperation {
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

interface BatchOperationsListProps {
  type?: string
  limit?: number
  title?: string
  description?: string
}

export function BatchOperationsList({
  type,
  limit = 10,
  title = "Batch Operations",
  description = "View and manage your batch operations",
}: BatchOperationsListProps) {
  const [operations, setOperations] = useState<BatchOperation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOperations = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = type ? `/api/v1/batch?type=${type}&limit=${limit}` : `/api/v1/batch?limit=${limit}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setOperations(data.operations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch operations")
      console.error("Error fetching batch operations:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOperations()
  }, [type, limit])

  const handleRefresh = () => {
    fetchOperations()
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {operations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-center text-muted-foreground">No batch operations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {operations.map((op) => (
              <div key={op.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Batch {op.id.substring(0, 8)}</h3>
                    <p className="text-xs text-muted-foreground">Created {new Date(op.created_at).toLocaleString()}</p>
                  </div>
                  <BatchStatusBadge status={op.status} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="font-medium">
                      {op.processed_items} / {op.total_items}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Success</p>
                    <p className="font-medium text-green-600">{op.successful_items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="font-medium text-red-600">{op.failed_items}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/trustedform/batch/${op.id}`}>
                      View Details
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
