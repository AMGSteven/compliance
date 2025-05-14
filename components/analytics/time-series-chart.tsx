"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { TimeSeriesData } from "@/lib/types/analytics"
import { formatDate, formatNumber } from "@/lib/utils/chart-utils"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type ChartType = "line" | "area" | "bar"

interface TimeSeriesChartProps {
  data: TimeSeriesData
  title: string
  description?: string
  valueLabel?: string
  dateLabel?: string
  groupBy?: "day" | "week" | "month"
  height?: number
  showLegend?: boolean
  type?: ChartType
  valueFormatter?: (value: number) => string
  dateFormatter?: (date: string) => string
  colors?: string[]
}

export function TimeSeriesChart({
  data,
  title,
  description,
  valueLabel = "Value",
  dateLabel = "Date",
  groupBy = "day",
  height = 300,
  showLegend = true,
  type = "line",
  valueFormatter = formatNumber,
  dateFormatter = (date) => formatDate(date, groupBy),
  colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"],
}: TimeSeriesChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Process data for the chart
  const chartData = data.series.map((point, index) => ({
    ...point,
    formattedDate: dateFormatter(point.date),
  }))

  // Determine if we have multiple categories
  const hasCategories = data.categories && data.categories.length > 0

  // Render the appropriate chart type
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    }

    switch (type) {
      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {hasCategories
                ? data.categories!.map((category, index) => (
                    <linearGradient key={category} id={`color-${category}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0.1} />
                    </linearGradient>
                  ))
                : [
                    <linearGradient key="default" id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={colors[0]} stopOpacity={0.1} />
                    </linearGradient>,
                  ]}
            </defs>
            <XAxis dataKey="formattedDate" />
            <YAxis tickFormatter={valueFormatter} />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), valueLabel]}
              labelFormatter={(label) => dateLabel + ": " + label}
            />
            {showLegend && hasCategories && <Legend />}
            {hasCategories
              ? data.categories!.map((category, index) => (
                  <Area
                    key={category}
                    type="monotone"
                    dataKey={`values.${category}`}
                    name={category}
                    stroke={colors[index % colors.length]}
                    fillOpacity={1}
                    fill={`url(#color-${category})`}
                  />
                ))
              : [
                  <Area
                    key="default"
                    type="monotone"
                    dataKey="value"
                    name={valueLabel}
                    stroke={colors[0]}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />,
                ]}
          </AreaChart>
        )
      case "bar":
        return (
          <BarChart {...commonProps}>
            <XAxis dataKey="formattedDate" />
            <YAxis tickFormatter={valueFormatter} />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), valueLabel]}
              labelFormatter={(label) => dateLabel + ": " + label}
            />
            {showLegend && hasCategories && <Legend />}
            {hasCategories
              ? data.categories!.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={`values.${category}`}
                    name={category}
                    fill={colors[index % colors.length]}
                  />
                ))
              : [<Bar key="default" dataKey="value" name={valueLabel} fill={colors[0]} />]}
          </BarChart>
        )
      case "line":
      default:
        return (
          <LineChart {...commonProps}>
            <XAxis dataKey="formattedDate" />
            <YAxis tickFormatter={valueFormatter} />
            <CartesianGrid strokeDasharray="3 3" />
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), valueLabel]}
              labelFormatter={(label) => dateLabel + ": " + label}
            />
            {showLegend && hasCategories && <Legend />}
            {hasCategories
              ? data.categories!.map((category, index) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={`values.${category}`}
                    name={category}
                    stroke={colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                  />
                ))
              : [
                  <Line
                    key="default"
                    type="monotone"
                    dataKey="value"
                    name={valueLabel}
                    stroke={colors[0]}
                    activeDot={{ r: 8 }}
                  />,
                ]}
          </LineChart>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
