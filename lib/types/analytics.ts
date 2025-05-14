export type TimeSeriesDataPoint = {
  date: string
  value: number
  category?: string
}

export type TimeSeriesData = {
  series: TimeSeriesDataPoint[]
  categories?: string[]
}

export type GeoDistributionData = {
  country: string
  state?: string
  city?: string
  count: number
  percentage: number
}

export type SourceDistributionData = {
  source: string
  count: number
  percentage: number
  successRate?: number
}

export type AnalyticsSummary = {
  totalCertificates: number
  verificationRate: number
  averageResponseTime: number
  certificatesByStatus: {
    verified: number
    invalid: number
    pending: number
  }
  certificatesBySource: SourceDistributionData[]
  certificatesByGeo: GeoDistributionData[]
  certificatesTrend: TimeSeriesData
  verificationRateTrend: TimeSeriesData
}

export type AnalyticsFilters = {
  dateRange?: {
    start: string
    end: string
  }
  source?: string
  status?: "verified" | "invalid" | "pending"
  groupBy?: "day" | "week" | "month"
}
