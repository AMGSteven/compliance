

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

export default function AnalyticsTestPage() {
  const [apiData, setApiData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalyticsData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/v1/trustedform/analytics")

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setApiData(data)
    } catch (err) {
      console.error("Error fetching analytics data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const handleRefresh = () => {
    fetchAnalyticsData()
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Test Page</h1>
          <p className="text-muted-foreground">Test the analytics API and data structures</p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : apiData ? (
        <Tabs defaultValue="raw">
          <TabsList>
            <TabsTrigger value="raw">Raw API Response</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="distributions">Distributions</TabsTrigger>
          </TabsList>

          <TabsContent value="raw" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Raw API Response</CardTitle>
                <CardDescription>The complete response from the analytics API</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[500px]">
                  {JSON.stringify(apiData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary Statistics</CardTitle>
                <CardDescription>Key metrics from the analytics data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-100 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Total Certificates</div>
                    <div className="text-2xl font-bold">{apiData.totalCertificates}</div>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Verification Rate</div>
                    <div className="text-2xl font-bold">{apiData.verificationRate}%</div>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <div className="text-sm font-medium text-gray-500">Avg. Response Time</div>
                    <div className="text-2xl font-bold">{apiData.averageResponseTime}s</div>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Status Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-100 p-4 rounded-md">
                      <div className="text-sm font-medium text-gray-500">Verified</div>
                      <div className="text-2xl font-bold">{apiData.certificatesByStatus.verified}</div>
                    </div>
                    <div className="bg-red-100 p-4 rounded-md">
                      <div className="text-sm font-medium text-gray-500">Invalid</div>
                      <div className="text-2xl font-bold">{apiData.certificatesByStatus.invalid}</div>
                    </div>
                    <div className="bg-yellow-100 p-4 rounded-md">
                      <div className="text-sm font-medium text-gray-500">Pending</div>
                      <div className="text-2xl font-bold">{apiData.certificatesByStatus.pending}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Time Series Data</CardTitle>
                <CardDescription>Certificate and verification rate trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Certificates Trend</h3>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto">
                    <pre>{JSON.stringify(apiData.certificatesTrend, null, 2)}</pre>
                  </div>

                  <h3 className="text-lg font-medium mt-4">Verification Rate Trend</h3>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto">
                    <pre>{JSON.stringify(apiData.verificationRateTrend, null, 2)}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distributions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribution Data</CardTitle>
                <CardDescription>Source and geographic distributions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Source Distribution</h3>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto">
                    <pre>{JSON.stringify(apiData.certificatesBySource, null, 2)}</pre>
                  </div>

                  <h3 className="text-lg font-medium mt-4">Geographic Distribution</h3>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto">
                    <pre>{JSON.stringify(apiData.certificatesByGeo, null, 2)}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Testing Instructions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">1. Check API Response</h3>
            <p>Verify that the API returns all required data fields and the structure matches our expectations.</p>
          </div>

          <div>
            <h3 className="text-lg font-medium">2. Test the Main Dashboard</h3>
            <p>
              Go to{" "}
              <a href="/trustedform/analytics" className="text-blue-600 hover:underline">
                /trustedform/analytics
              </a>{" "}
              and test:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>All charts and visualizations render correctly</li>
              <li>Date range picker changes the data displayed</li>
              <li>Grouping options (daily, weekly, monthly) work</li>
              <li>Chart type selector changes the visualization</li>
              <li>Tabs switch between different views</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-medium">3. Test Error Handling</h3>
            <p>Verify that the dashboard handles errors gracefully and displays appropriate messages.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
