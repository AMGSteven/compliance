"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils/chart-utils"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

interface Stat {
  title: string
  value: number
  description?: string
  change?: number
  changeLabel?: string
  formatter?: (value: number) => string
  icon?: React.ReactNode
}

interface StatsGridProps {
  stats: Stat[]
  columns?: 1 | 2 | 3 | 4
}

export function StatsGrid({ stats, columns = 3 }: StatsGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            {stat.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.formatter ? stat.formatter(stat.value) : formatNumber(stat.value)}
            </div>
            {(stat.description || stat.change !== undefined) && (
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {stat.change !== undefined && (
                  <span
                    className={`mr-1 flex items-center ${
                      stat.change > 0 ? "text-green-500" : stat.change < 0 ? "text-red-500" : "text-gray-500"
                    }`}
                  >
                    {stat.change > 0 ? (
                      <ArrowUpIcon className="h-3 w-3 mr-1" />
                    ) : stat.change < 0 ? (
                      <ArrowDownIcon className="h-3 w-3 mr-1" />
                    ) : null}
                    {Math.abs(stat.change).toFixed(1)}%
                  </span>
                )}
                {stat.changeLabel || stat.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
