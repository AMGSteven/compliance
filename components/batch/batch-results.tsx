"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Download } from "lucide-react"
import { BatchStatusBadge } from "@/components/batch/batch-status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface BatchResult {
  id: string
  batch_operation_id: string // Updated to match the database schema
  item_id: string
  success: boolean
  message: string
  data?: any
  created_at: string
}

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
  results?: BatchResult[]
}

interface BatchResultsProps {
  batchId: string
  refreshInterval?: number // in milliseconds
}

export function BatchResults({ batchId, refreshInterval = 5000 }: BatchResultsProps) {
  const [batch, setBatch] = useState<BatchOperation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null)

  const fetchBatchResults = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/v1/batch/${batchId}`)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setBatch(data.batch)

      // If the batch is still processing, set up a refresh timer
      if (data.batch.status === "pending" || data.batch.status === "processing") {
        if (refreshTimer) clearTimeout(refreshTimer)
        const timer = setTimeout(() => fetchBatchResults(), refreshInterval)
        setRefreshTimer(timer)
      } else if (refreshTimer) {
        clearTimeout(refreshTimer)
        setRefreshTimer(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch results")
      console.error("Error fetching batch results:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatchResults()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [batchId])

  const handleRefresh = () => {
    setLoading(true)
    fetchBatchResults()
  }

  const handleExport = () => {
    if (!batch || !batch.results) return

    // Create CSV content
    const headers = ["Item ID", "Status", "Message", "Created At"]
    const rows = batch.results.map((result) => [
      result.item_id,
      result.success ? "Success" : "Failed",
      result.message,
      new Date(result.created_at).toLocaleString(),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `batch-${batchId}-results.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading && !batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>Loading batch operation details...</CardDescription>
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
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>Error loading batch operation details</CardDescription>
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

  if (!batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>Batch operation not found</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Not Found</AlertTitle>
            <AlertDescription>The requested batch operation could not be found.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Batch Results</CardTitle>
          <CardDescription>Results for batch operation {batchId}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
          {batch.results && batch.results.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Export</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <div className="mt-1 flex items-center">
              <BatchStatusBadge status={batch.status} />
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Progress</div>
            <div className="mt-1 text-2xl font-bold">
              {batch.processed_items} / {batch.total_items}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
            <div className="mt-1 text-2xl font-bold text-green-600">
              {batch.processed_items > 0 ? Math.round((batch.successful_items / batch.processed_items) * 100) : 0}%
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Created</div>
            <div className="mt-1 text-sm">{new Date(batch.created_at).toLocaleString()}</div>
          </div>
        </div>

        {batch.status === "pending" || batch.status === "processing" ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-center text-muted-foreground">
              {batch.status === "pending" ? "Waiting to process..." : "Processing batch operation..."}
              <br />
              {batch.processed_items} of {batch.total_items} items processed
            </p>
          </div>
        ) : batch.results && batch.results.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-mono text-xs">{result.item_id}</TableCell>
                    <TableCell>
                      {result.success ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md truncate" title={result.message}>
                      {result.message}
                    </TableCell>
                    <TableCell>{new Date(result.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-center text-muted-foreground">No results available for this batch operation.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
