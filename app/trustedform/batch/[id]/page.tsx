

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { BatchStatusBadge } from "@/components/batch/batch-status-badge"
import { BatchExport } from "@/components/batch/batch-export"
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, CheckCircle } from "lucide-react"
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

interface BatchResult {
  id: string
  batch_operation_id: string
  item_id: string
  success: boolean
  message: string
  data?: any
  created_at: string
}

export default function BatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const batchId = params.id as string

  const [batch, setBatch] = useState<BatchOperation | null>(null)
  const [results, setResults] = useState<BatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const fetchBatchDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/v1/batch/${batchId}`)

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setBatch(data.batch)
      setResults(data.results || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load batch details")
      console.error("Error fetching batch details:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (batchId) {
      fetchBatchDetails()
    }
  }, [batchId])

  // Set up polling for pending or processing batches
  useEffect(() => {
    if (!batch || (batch.status !== "pending" && batch.status !== "processing")) {
      return
    }

    const interval = setInterval(() => {
      fetchBatchDetails()
    }, 5000)

    return () => clearInterval(interval)
  }, [batch])

  const getSuccessRate = () => {
    if (!batch || batch.processed_items === 0) {
      return 0
    }
    return Math.round((batch.successful_items / batch.processed_items) * 100)
  }

  const getProgressPercentage = () => {
    if (!batch || batch.total_items === 0) {
      return 0
    }
    return Math.round((batch.processed_items / batch.total_items) * 100)
  }

  if (loading && !batch) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={fetchBatchDetails}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>The requested batch operation was not found.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform/batch">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Batch Operation Details</h1>
            <p className="text-muted-foreground">
              {batch.type === "trustedform_verification" ? "TrustedForm Certificate Verification" : batch.type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBatchDetails} disabled={loading} className="hidden sm:flex">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <BatchExport batchId={batch.id} disabled={batch.status === "pending" || batch.processed_items === 0} />
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Batch Status</CardTitle>
              <BatchStatusBadge status={batch.status} />
            </div>
            <CardDescription>
              Created {new Date(batch.created_at).toLocaleString()}
              {batch.completed_at && ` • Completed ${new Date(batch.completed_at).toLocaleString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{batch.total_items}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processed</p>
                <p className="text-2xl font-bold">
                  {batch.processed_items} ({getProgressPercentage()}%)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-600">{batch.successful_items}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{batch.failed_items}</p>
              </div>
            </div>

            {(batch.status === "pending" || batch.status === "processing") && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-sm font-medium">{getProgressPercentage()}%</p>
                </div>
                <Progress value={getProgressPercentage()} />
              </div>
            )}

            {batch.status === "completed" && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-sm font-medium">{getSuccessRate()}%</p>
                </div>
                <Progress
                  value={getSuccessRate()}
                  className={
                    getSuccessRate() > 80 ? "bg-green-100" : getSuccessRate() > 50 ? "bg-yellow-100" : "bg-red-100"
                  }
                  indicatorClassName={
                    getSuccessRate() > 80 ? "bg-green-600" : getSuccessRate() > 50 ? "bg-yellow-600" : "bg-red-600"
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Overview</CardTitle>
                <CardDescription>Summary of the batch operation</CardDescription>
              </CardHeader>
              <CardContent>
                {batch.status === "completed" && (
                  <Alert
                    variant={getSuccessRate() > 80 ? "success" : getSuccessRate() > 50 ? "default" : "destructive"}
                    className="mb-4"
                  >
                    {getSuccessRate() > 80 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>
                      {getSuccessRate() > 80
                        ? "Batch Completed Successfully"
                        : getSuccessRate() > 50
                          ? "Batch Completed with Warnings"
                          : "Batch Completed with Errors"}
                    </AlertTitle>
                    <AlertDescription>
                      {getSuccessRate() > 80
                        ? `${batch.successful_items} out of ${batch.processed_items} items were processed successfully.`
                        : getSuccessRate() > 50
                          ? `${batch.successful_items} out of ${batch.processed_items} items were processed successfully, but ${batch.failed_items} items failed.`
                          : `Only ${batch.successful_items} out of ${batch.processed_items} items were processed successfully. ${batch.failed_items} items failed.`}
                    </AlertDescription>
                  </Alert>
                )}

                {batch.status === "processing" && (
                  <Alert className="mb-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Batch Processing</AlertTitle>
                    <AlertDescription>
                      {batch.processed_items} out of {batch.total_items} items have been processed.
                    </AlertDescription>
                  </Alert>
                )}

                {batch.status === "pending" && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Batch Pending</AlertTitle>
                    <AlertDescription>
                      This batch is waiting to be processed. It will start processing soon.
                    </AlertDescription>
                  </Alert>
                )}

                {batch.status === "failed" && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Batch Failed</AlertTitle>
                    <AlertDescription>
                      The batch operation failed. Please check the logs for more information.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Batch ID</h3>
                    <p className="text-sm text-muted-foreground">{batch.id}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Type</h3>
                    <p className="text-sm text-muted-foreground">
                      {batch.type === "trustedform_verification" ? "TrustedForm Certificate Verification" : batch.type}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Created At</h3>
                    <p className="text-sm text-muted-foreground">{new Date(batch.created_at).toLocaleString()}</p>
                  </div>
                  {batch.completed_at && (
                    <div>
                      <h3 className="text-sm font-medium">Completed At</h3>
                      <p className="text-sm text-muted-foreground">{new Date(batch.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                  {batch.metadata && (
                    <div>
                      <h3 className="text-sm font-medium">Metadata</h3>
                      <pre className="mt-2 rounded-md bg-muted p-4 text-xs">
                        {JSON.stringify(batch.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="results" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Batch Results</CardTitle>
                  <CardDescription>
                    {results.length} {results.length === 1 ? "result" : "results"}
                  </CardDescription>
                </div>
                <BatchExport batchId={batch.id} disabled={batch.status === "pending" || batch.processed_items === 0} />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-center text-muted-foreground">No results available yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {results.map((result) => (
                      <div key={result.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium">{result.item_id}</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(result.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {result.success ? "Success" : "Failed"}
                          </div>
                        </div>
                        <p className="mt-2 text-sm">{result.message}</p>
                        {result.data && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                              View Details
                            </summary>
                            <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
