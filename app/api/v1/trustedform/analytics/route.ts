import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { AnalyticsSummary } from "@/lib/types/analytics"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const source = searchParams.get("source") || undefined
    const status = searchParams.get("status") || undefined
    const groupBy = (searchParams.get("groupBy") as "day" | "week" | "month") || "day"

    const supabase = createServerClient()

    // Try to fetch real data
    try {
      // Instead of trying to use complex queries that might not be supported,
      // let's just use our SQL functions that we've already created

      // For development/testing, we'll just use mock data
      // In production, you would uncomment and use the SQL functions

      /*
      // Fetch certificate counts by source
      const { data: sourceCounts, error: sourceError } = await supabase.rpc("get_certificates_by_source")
      if (sourceError) throw new Error(sourceError.message)

      // Fetch certificate counts by geo
      const { data: geoCounts, error: geoError } = await supabase.rpc("get_certificates_by_geo")
      if (geoError) throw new Error(geoError.message)

      // Fetch certificate trend over time
      const { data: trendData, error: trendError } = await supabase.rpc("get_certificates_trend", {
        group_by: groupBy,
        start_date: startDate,
        end_date: endDate,
      })
      if (trendError) throw new Error(trendError.message)

      // Fetch verification rate trend over time
      const { data: rateData, error: rateError } = await supabase.rpc("get_verification_rate_trend", {
        group_by: groupBy,
        start_date: startDate,
        end_date: endDate,
      })
      if (rateError) throw new Error(rateError.message)
      */

      // For now, we'll just throw an error to use mock data
      throw new Error("Using mock data for development")
    } catch (dbError) {
      console.error("Database error in analytics:", dbError)
      // Fall back to mock data
    }

    // Return mock data for development/preview
    const mockData: AnalyticsSummary = generateMockAnalyticsData(startDate, endDate, groupBy)

    // Set header to indicate we're using sample data
    const headers = new Headers()
    headers.set("X-Using-Sample-Data", "true")

    return NextResponse.json(mockData, { headers })
  } catch (error) {
    console.error("Error fetching TrustedForm analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateMockAnalyticsData(
  startDate?: string,
  endDate?: string,
  groupBy: "day" | "week" | "month" = "day",
): AnalyticsSummary {
  // Set default date range if not provided
  const end = endDate ? new Date(endDate) : new Date()
  const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())

  // Generate time series data
  const certificatesTrend = generateTimeSeries(start, end, groupBy)
  const verificationRateTrend = generateTimeSeries(start, end, groupBy, true)

  // Generate source distribution
  const sources = ["API", "Web Form", "Partner Integration", "Batch Upload", "Manual Entry"]
  const certificatesBySource = sources.map((source) => ({
    source,
    count: Math.floor(Math.random() * 1000) + 100,
    percentage: 0,
    successRate: Math.round((Math.random() * 30 + 70) * 10) / 10, // 70-100%
  }))

  // Calculate percentages
  const totalBySource = certificatesBySource.reduce((sum, item) => sum + item.count, 0)
  certificatesBySource.forEach((item) => {
    item.percentage = Math.round((item.count / totalBySource) * 1000) / 10
  })

  // Generate geo distribution
  const geoData = [
    { country: "United States", state: "California", count: 450, percentage: 30 },
    { country: "United States", state: "Texas", count: 300, percentage: 20 },
    { country: "United States", state: "Florida", count: 225, percentage: 15 },
    { country: "United States", state: "New York", count: 150, percentage: 10 },
    { country: "Canada", state: "Ontario", count: 120, percentage: 8 },
    { country: "United Kingdom", state: null, count: 105, percentage: 7 },
    { country: "Australia", state: null, count: 90, percentage: 6 },
    { country: "Other", state: null, count: 60, percentage: 4 },
  ]

  return {
    totalCertificates: 1500,
    verificationRate: 87.5,
    averageResponseTime: 1.2, // seconds
    certificatesByStatus: {
      verified: 1200,
      invalid: 150,
      pending: 150,
    },
    certificatesBySource,
    certificatesByGeo: geoData,
    certificatesTrend,
    verificationRateTrend,
  }
}

function generateTimeSeries(
  start: Date,
  end: Date,
  groupBy: "day" | "week" | "month",
  isRate = false,
): { series: Array<{ date: string; value: number }> } {
  const series = []
  const current = new Date(start)
  const increment = groupBy === "day" ? 1 : groupBy === "week" ? 7 : 30

  while (current <= end) {
    const value = isRate
      ? Math.round((Math.random() * 20 + 75) * 10) / 10 // 75-95% for rates
      : Math.floor(Math.random() * 100) + 20 // 20-120 for counts

    series.push({
      date: current.toISOString().split("T")[0],
      value,
    })

    current.setDate(current.getDate() + increment)
  }

  return { series }
}
