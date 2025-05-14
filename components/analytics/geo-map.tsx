"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GeoDistributionData } from "@/lib/types/analytics"
import { formatNumber } from "@/lib/utils/chart-utils"
import { useState } from "react"

interface GeoMapProps {
  data: GeoDistributionData[]
  title: string
  description?: string
  height?: number
  valueFormatter?: (value: number) => string
}

export function GeoMap({ data, title, description, height = 400, valueFormatter = formatNumber }: GeoMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

  // Group data by country
  const countryData = data.reduce(
    (acc, item) => {
      const country = item.country
      if (!acc[country]) {
        acc[country] = {
          country,
          count: 0,
          percentage: 0,
          states: [],
        }
      }

      acc[country].count += item.count
      acc[country].percentage += item.percentage

      if (item.state) {
        acc[country].states.push({
          state: item.state,
          count: item.count,
          percentage: item.percentage,
        })
      }

      return acc
    },
    {} as Record<string, any>,
  )

  // Convert to array and sort by count
  const countries = Object.values(countryData).sort((a, b) => b.count - a.count)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* In a real implementation, we would use a map visualization library here */}
          {/* For now, we'll use a simple list with visual indicators */}
          <div className="grid gap-2">
            {countries.map((country) => (
              <div
                key={country.country}
                className="p-3 rounded-md border hover:bg-gray-50 transition-colors"
                onMouseEnter={() => setHoveredRegion(country.country)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div className="flex justify-between items-center">
                  <div className="font-medium">{country.country}</div>
                  <div className="text-sm text-gray-500">
                    {valueFormatter(country.count)} ({country.percentage.toFixed(1)}%)
                  </div>
                </div>

                <div className="mt-1 w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${country.percentage}%` }}></div>
                </div>

                {/* Show states if this country is hovered and has states */}
                {hoveredRegion === country.country && country.states.length > 0 && (
                  <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                    {country.states.map((state: any) => (
                      <div key={state.state} className="flex justify-between text-sm">
                        <div>{state.state}</div>
                        <div className="text-gray-500">
                          {valueFormatter(state.count)} ({state.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 text-center mt-4">
            Hover over countries to see state/region breakdown
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
