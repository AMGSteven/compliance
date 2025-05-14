import type { TimeSeriesData, TimeSeriesDataPoint } from "../types/analytics"

// Format date for display in charts
export function formatDate(dateString: string, groupBy: "day" | "week" | "month" = "day"): string {
  const date = new Date(dateString)

  if (groupBy === "month") {
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date)
  } else if (groupBy === "week") {
    return `Week ${getWeekNumber(date)}, ${date.getFullYear()}`
  } else {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date)
  }
}

// Get week number of the year
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}

// Format number with K/M suffix for large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  } else {
    return num.toString()
  }
}

// Generate colors for chart series
export function generateChartColors(count: number): string[] {
  const baseColors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#6366f1", // indigo
  ]

  // If we need more colors than in our base set, generate them
  if (count <= baseColors.length) {
    return baseColors.slice(0, count)
  }

  // Generate additional colors by rotating hue
  const result = [...baseColors]
  const needed = count - baseColors.length

  for (let i = 0; i < needed; i++) {
    const hue = (i * 137.5) % 360 // Golden angle approximation for good distribution
    result.push(`hsl(${hue}, 70%, 60%)`)
  }

  return result
}

// Process time series data for charts
export function processTimeSeriesData(
  data: TimeSeriesData,
  groupBy: "day" | "week" | "month" = "day",
): TimeSeriesDataPoint[] {
  return data.series.map((point) => ({
    ...point,
    formattedDate: formatDate(point.date, groupBy),
  }))
}
