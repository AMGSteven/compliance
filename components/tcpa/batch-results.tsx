"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertCircle, Loader2, Download, RefreshCw } from "lucide-react"

interface BatchResultsProps {
  batchId: string
}

export function BatchResults({ batchId }: BatchResultsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [batchData, setBatchData] = useState<any>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  const fetchBatchData = async () => {
    try {
      const response = await fetch(`/api/v1/tcpa/batch/${batchId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch batch results")
      }

      const data = await response.json()
      setBatchData(data)

      // If the batch is still processing, continue refreshing
      if (data.status === "processing" || data.status === "pending") {
        if (!refreshInterval) {
          const interval = setInterval(() => {
            fetchBatchData()
          }, 5000) // Refresh every 5 seconds
          setRefreshInterval(interval)
        }
      } else if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      if (refreshInterval) {
        clearInterval(refreshInterval)
        setRefreshInterval(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatchData()

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [batchId])

  const handleRefresh = () => {
    setLoading(true)
    fetchBatchData()
  }

  const handleExport = () => {
    if (!batchData) return

    // Create CSV content
    const headers = ["Phone", "Contact Name", "Compliant", "Reasons"]
    const rows = batchData.results.map((result: any) => [
      result.phone,
      result.contactName || "",
      result.compliant ? "Yes" : "No",
      result.reasons.join("; "),
    ])

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `tcpa-batch-${batchId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading && !batchData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Batch Results</CardTitle>
          <CardDescription>Please wait while we fetch the batch results</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error && !batchData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>An error occurred while fetching the batch results</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!batchData) {
    return null
  }

  const isProcessing = batchData.status === "processing" || batchData.status === "pending"
  const progress = isProcessing ? Math.round((batchData.totalChecked / (batchData.results?.length || 1)) * 100) : 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>TCPA Batch Check Results</CardTitle>
            <CardDescription>Batch ID: {batchId}</CardDescription>
          </div>
          <Badge
            variant={
              batchData.status === "completed" ? "success" : batchData.status === "failed" ? "destructive" : "outline"
            }
          >
            {batchData.status.charAt(0).toUpperCase() + batchData.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing...</span>
              <span>
                {batchData.totalChecked} of {batchData.results?.length || "?"} checked
              </span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Total Checked</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold">{batchData.totalChecked}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Compliant</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-green-600">{batchData.compliantCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-lg">Non-Compliant</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-bold text-red-600">{batchData.nonCompliantCount}</p>
            </CardContent>
          </Card>
        </div>

        {batchData.results && batchData.results.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reasons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchData.results.map((result: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.phone}</TableCell>
                    <TableCell>{result.contactName || "-"}</TableCell>
                    <TableCell>
                      {result.compliant ? (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Non-Compliant
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.reasons && result.reasons.length > 0
                        ? result.reasons.join(", ")
                        : result.compliant
                          ? "No issues found"
                          : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        {batchData.status === "completed" && (
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
