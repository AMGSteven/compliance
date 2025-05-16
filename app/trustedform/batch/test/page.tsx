

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { generateMockCertificates } from "@/lib/utils/mock-data"

export default function BatchTestPage() {
  const router = useRouter()
  const [count, setCount] = useState<number>(10)
  const [successRate, setSuccessRate] = useState<number>(80)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<string>("generate")

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (!isNaN(value) && value > 0 && value <= 1000) {
      setCount(value)
    }
  }

  const handleSuccessRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value)
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setSuccessRate(value)
    }
  }

  const handleGenerateTest = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)

      // Generate mock certificates
      const mockCertificates = generateMockCertificates(count)

      // Create a test batch
      const response = await fetch("/api/v1/trustedform/batch/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          certificates: mockCertificates,
          successRate,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `HTTP error ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
      setActiveTab("result")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error generating test batch:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewBatch = () => {
    if (result && result.batchId) {
      router.push(`/trustedform/batch/${result.batchId}`)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/trustedform/batch">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Batch Operations</h1>
          <p className="text-muted-foreground">Generate test data to try out batch operations</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">Generate Test Data</TabsTrigger>
          <TabsTrigger value="result" disabled={!result}>
            Test Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate Test Batch</CardTitle>
              <CardDescription>
                Create a test batch with mock TrustedForm certificates to test the batch operations functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="count">Number of Certificates</Label>
                <Input id="count" type="number" min="1" max="1000" value={count} onChange={handleCountChange} />
                <p className="text-xs text-muted-foreground">How many mock certificates to generate (1-1000)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="successRate">Success Rate (%)</Label>
                <Input
                  id="successRate"
                  type="number"
                  min="0"
                  max="100"
                  value={successRate}
                  onChange={handleSuccessRateChange}
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of certificates that will be successfully verified (0-100)
                </p>
              </div>

              <div className="rounded-md bg-muted p-4">
                <h3 className="mb-2 text-sm font-medium">What this will do:</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Generate {count} mock TrustedForm certificates with random data</li>
                  <li>Create a batch operation with these certificates</li>
                  <li>Simulate verification with a {successRate}% success rate</li>
                  <li>Process the batch and show the results</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleGenerateTest} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Test Batch...
                  </>
                ) : (
                  "Generate Test Batch"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="result">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Test Batch Created</CardTitle>
                <CardDescription>Your test batch has been created and is being processed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="success" className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Test batch created successfully with ID: <span className="font-mono">{result.batchId}</span>
                  </AlertDescription>
                </Alert>

                <div className="rounded-md border p-4">
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2">
                      <div className="text-sm font-medium">Batch ID:</div>
                      <div className="text-sm font-mono">{result.batchId}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="text-sm font-medium">Status:</div>
                      <div className="text-sm capitalize">{result.status}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="text-sm font-medium">Total Items:</div>
                      <div className="text-sm">{result.totalItems}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="text-sm font-medium">Expected Success Rate:</div>
                      <div className="text-sm">{successRate}%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab("generate")}>
                  Generate Another Test
                </Button>
                <Button onClick={handleViewBatch}>View Batch Details</Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
