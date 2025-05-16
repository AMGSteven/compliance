

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { DateRangePicker } from "@/components/analytics/date-range-picker"
import { GeoMap } from "@/components/analytics/geo-map"
import { PieChartComponent } from "@/components/analytics/pie-chart"
import { StatsGrid } from "@/components/analytics/stats-grid"
import { TimeSeriesChart } from "@/components/analytics/time-series-chart"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AnalyticsSummary } from "@/lib/types/analytics"
import { AlertCircle, BarChart3, LineChart, PieChart, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

export default function TrustedFormAnalyticsPage() {
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date
  })
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day")
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [usingSampleData, setUsingSampleData] = useState(false)

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
      })

      const response = await fetch(`/api/v1/trustedform/analytics?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`)
      }

      const result = await response.json()
      setData(result)

      // Check if we're using sample data
      setUsingSampleData(response.headers.get("X-Using-Sample-Data") === "true")
    } catch (err) {
      console.error("Error fetching analytics:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setUsingSampleData(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [startDate, endDate, groupBy])

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleRefresh = () => {
    fetchAnalytics()
  }

  // Prepare data for charts if available
  const statusData = data
    ? [
        {
          name: "Verified",
          value: data.certificatesByStatus.verified,
          color: "#10b981", // green
        },
        {
          name: "Invalid",
          value: data.certificatesByStatus.invalid,
          color: "#ef4444", // red
        },
        {
          name: "Pending",
          value: data.certificatesByStatus.pending,
          color: "#f59e0b", // amber
        },
      ]
    : []

  const sourceData = data
    ? data.certificatesBySource.map((source) => ({
        name: source.source,
        value: source.count,
      }))
    : []

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TrustedForm Analytics</h1>
          <p className="text-muted-foreground">
            Analyze your TrustedForm certificate verification performance and trends
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {usingSampleData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sample Data</AlertTitle>
          <AlertDescription>
            You're viewing sample data. Connect to a database with TrustedForm certificates to see real analytics.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <DateRangePicker startDate={startDate} endDate={endDate} onRangeChange={handleDateRangeChange} />
        <div className="flex gap-2">
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chartType} onValueChange={(value) => setChartType(value as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Chart type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">
                <div className="flex items-center">
                  <LineChart className="mr-2 h-4 w-4" />
                  Line
                </div>
              </SelectItem>
              <SelectItem value="area">
                <div className="flex items-center">
                  <LineChart className="mr-2 h-4 w-4" />
                  Area
                </div>
              </SelectItem>
              <SelectItem value="bar">
                <div className="flex items-center">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Bar
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <StatsGrid
            stats={[
              {
                title: "Total Certificates",
                value: data.totalCertificates,
                description: "All-time total",
              },
              {
                title: "Verification Rate",
                value: data.verificationRate,
                formatter: (value) => `${value}%`,
                description: "Successfully verified",
              },
              {
                title: "Avg. Response Time",
                value: data.averageResponseTime,
                formatter: (value) => `${value}s`,
                description: "Certificate verification",
              },
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TimeSeriesChart
              data={data.certificatesTrend}
              title="Certificate Volume"
              description="Number of certificates over time"
              valueLabel="Certificates"
              dateLabel="Date"
              groupBy={groupBy}
              type={chartType}
            />
            <TimeSeriesChart
              data={data.verificationRateTrend}
              title="Verification Rate"
              description="Percentage of successfully verified certificates"
              valueLabel="Rate"
              dateLabel="Date"
              groupBy={groupBy}
              type={chartType}
              valueFormatter={(value) => `${value}%`}
            />
          </div>

          <Tabs defaultValue="status">
            <TabsList>
              <TabsTrigger value="status">
                <PieChart className="h-4 w-4 mr-2" />
                Status Distribution
              </TabsTrigger>
              <TabsTrigger value="source">
                <PieChart className="h-4 w-4 mr-2" />
                Source Distribution
              </TabsTrigger>
              <TabsTrigger value="geo">
                <BarChart3 className="h-4 w-4 mr-2" />
                Geographic Distribution
              </TabsTrigger>
            </TabsList>
            <TabsContent value="status" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PieChartComponent
                  data={statusData}
                  title="Certificates by Status"
                  description="Distribution of certificates by verification status"
                  valueLabel="Certificates"
                  innerRadius={60}
                  outerRadius={90}
                />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Status Breakdown</h3>
                  <p className="text-sm text-muted-foreground">
                    This chart shows the distribution of certificates by their verification status.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                      <span className="font-medium">Verified:</span>
                      <span className="ml-2">
                        {data.certificatesByStatus.verified} certificates (
                        {Math.round((data.certificatesByStatus.verified / data.totalCertificates) * 100)}%)
                      </span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                      <span className="font-medium">Invalid:</span>
                      <span className="ml-2">
                        {data.certificatesByStatus.invalid} certificates (
                        {Math.round((data.certificatesByStatus.invalid / data.totalCertificates) * 100)}%)
                      </span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
                      <span className="font-medium">Pending:</span>
                      <span className="ml-2">
                        {data.certificatesByStatus.pending} certificates (
                        {Math.round((data.certificatesByStatus.pending / data.totalCertificates) * 100)}%)
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="source" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PieChartComponent
                  data={sourceData}
                  title="Certificates by Source"
                  description="Distribution of certificates by source"
                  valueLabel="Certificates"
                  innerRadius={60}
                  outerRadius={90}
                />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Source Performance</h3>
                  <p className="text-sm text-muted-foreground">
                    This table shows the performance of each source in terms of verification success rate.
                  </p>
                  <div className="border rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Success Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.certificatesBySource.map((source) => (
                          <tr key={source.source}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {source.source}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {source.count} ({source.percentage}%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <div
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    (source.successRate || 0) >= 90
                                      ? "bg-green-500"
                                      : (source.successRate || 0) >= 70
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                ></div>
                                {source.successRate}%
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="geo" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GeoMap
                  data={data.certificatesByGeo}
                  title="Geographic Distribution"
                  description="Distribution of certificates by location"
                />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Regional Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    This chart shows the distribution of certificates by geographic location. Understanding regional
                    patterns can help optimize your lead generation and compliance strategies.
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Key Observations:</h4>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>
                        {data.certificatesByGeo[0]?.country} leads with {data.certificatesByGeo[0]?.percentage}% of all
                        certificates
                      </li>
                      {data.certificatesByGeo[0]?.state && (
                        <li>
                          {data.certificatesByGeo[0].state} is the top state in {data.certificatesByGeo[0].country}
                        </li>
                      )}
                      <li>
                        Top 3 regions account for{" "}
                        {data.certificatesByGeo
                          .slice(0, 3)
                          .reduce((sum, item) => sum + item.percentage, 0)
                          .toFixed(1)}
                        % of all certificates
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  )
}
