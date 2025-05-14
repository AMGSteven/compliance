"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, generateChartColors } from "@/lib/utils/chart-utils"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts"
import { useState } from "react"

interface PieChartProps {
  data: Array<{
    name: string
    value: number
    color?: string
  }>
  title: string
  description?: string
  valueLabel?: string
  height?: number
  showLegend?: boolean
  valueFormatter?: (value: number) => string
  colors?: string[]
  innerRadius?: number
  outerRadius?: number
}

export function PieChartComponent({
  data,
  title,
  description,
  valueLabel = "Value",
  height = 300,
  showLegend = true,
  valueFormatter = formatNumber,
  colors,
  innerRadius = 0,
  outerRadius = 80,
}: PieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Generate colors if not provided
  const chartColors = colors || generateChartColors(data.length)

  // Calculate total for percentage
  const total = data.reduce((sum, item) => sum + item.value, 0)

  // Custom active shape for better hover effect
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props

    return (
      <g>
        <text x={cx} y={cy} dy={-20} textAnchor="middle" fill="#888">
          {payload.name}
        </text>
        <text x={cx} y={cy} textAnchor="middle" fill="#333" style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
          {valueFormatter(value)}
        </text>
        <text x={cx} y={cy} dy={25} textAnchor="middle" fill="#888">
          {`${(percent * 100).toFixed(1)}%`}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 12}
          outerRadius={outerRadius + 16}
          fill={fill}
        />
      </g>
    )
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
            <PieChart>
              <Pie
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  `${valueFormatter(value)} (${((value / total) * 100).toFixed(1)}%)`,
                  valueLabel,
                ]}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
