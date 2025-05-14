"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

const data = [
  {
    name: "Jan",
    total: 99.7,
  },
  {
    name: "Feb",
    total: 99.6,
  },
  {
    name: "Mar",
    total: 99.8,
  },
  {
    name: "Apr",
    total: 99.8,
  },
  {
    name: "May",
    total: 99.9,
  },
  {
    name: "Jun",
    total: 99.8,
  },
  {
    name: "Jul",
    total: 99.7,
  },
  {
    name: "Aug",
    total: 99.8,
  },
  {
    name: "Sep",
    total: 99.9,
  },
  {
    name: "Oct",
    total: 99.9,
  },
  {
    name: "Nov",
    total: 99.8,
  },
  {
    name: "Dec",
    total: 99.8,
  },
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          domain={[99.5, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, "Compliance Rate"]}
          labelFormatter={(label) => `Month: ${label}`}
        />
        <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  )
}
