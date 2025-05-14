"use client"

import { useEffect, useState } from "react"
import { StatsCard } from "@/components/dashboard/stats-card"
import { RecentOptOuts } from "@/components/dashboard/recent-opt-outs"
import type { DashboardStats } from "@/lib/types"
import {
  Users,
  Shield,
  CheckCircle,
  Mail,
  Phone,
  MessageSquare,
  MapPin,
  FileCheck,
  Clock,
  BarChart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Fallback data for development/preview
const fallbackStats: DashboardStats = {
  totalContacts: 1250,
  totalOptOuts: 87,
  emailOptOuts: 45,
  phoneOptOuts: 22,
  smsOptOuts: 15,
  postalOptOuts: 5,
  complianceRate: 99.2,
  recentOptOuts: [],
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trustedFormStats, setTrustedFormStats] = useState<any>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        // First try to fetch real data
        const dashboardResponse = await fetch("/api/v1/dashboard-stats")

        if (!dashboardResponse.ok) {
          console.warn("Dashboard stats API returned non-OK status:", dashboardResponse.status)
          setStats(fallbackStats)
        } else {
          const dashboardData = await dashboardResponse.json()
          setStats(dashboardData)
        }

        // Try to fetch TrustedForm stats
        try {
          const trustedFormResponse = await fetch("/api/v1/trustedform/stats")
          if (trustedFormResponse.ok) {
            const trustedFormData = await trustedFormResponse.json()
            setTrustedFormStats(trustedFormData)
          }
        } catch (tfError) {
          console.warn("Error fetching TrustedForm stats:", tfError)
          // Continue without TrustedForm stats
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err)
        setError("Unable to load live data. Showing sample data instead.")
        setStats(fallbackStats)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col p-8">
        <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-juiced-gradient">
          Juiced Media Compliance Engine
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="loading-gradient h-2 w-40 rounded-full"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col p-8">
      <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-juiced-gradient">
        Juiced Media Compliance Engine
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-700">
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard title="Total Contacts" value={stats?.totalContacts.toLocaleString() || "0"} icon={<Users />} />
        <StatsCard title="Active Opt-Outs" value={stats?.totalOptOuts.toLocaleString() || "0"} icon={<Shield />} />
        <StatsCard title="Compliance Rate" value={`${stats?.complianceRate || 100}%`} icon={<CheckCircle />} />
        <StatsCard title="Email Opt-Outs" value={stats?.emailOptOuts.toLocaleString() || "0"} icon={<Mail />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="lg:col-span-2">
          <RecentOptOuts optOuts={stats?.recentOptOuts || []} />
        </div>
        <div>
          <ChannelBreakdown
            emailOptOuts={stats?.emailOptOuts || 0}
            phoneOptOuts={stats?.phoneOptOuts || 0}
            smsOptOuts={stats?.smsOptOuts || 0}
            postalOptOuts={stats?.postalOptOuts || 0}
          />
        </div>
      </div>

      {trustedFormStats && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-juiced-gradient">
            TrustedForm Certificates
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatsCard
              title="Total Certificates"
              value={trustedFormStats.totalCertificates.toLocaleString()}
              icon={<FileCheck className="h-4 w-4" />}
            />
            <StatsCard
              title="Verified Certificates"
              value={trustedFormStats.verifiedCertificates.toLocaleString()}
              icon={<CheckCircle className="h-4 w-4" />}
            />
            <StatsCard
              title="Pending Verification"
              value={trustedFormStats.pendingCertificates.toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatsCard
              title="Verification Rate"
              value={`${trustedFormStats.verificationSuccessRate}%`}
              icon={<BarChart className="h-4 w-4" />}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="gradient" asChild className="pulse-on-hover">
              <Link href="/trustedform">View TrustedForm Dashboard</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

function ChannelBreakdown({
  emailOptOuts,
  phoneOptOuts,
  smsOptOuts,
  postalOptOuts,
}: {
  emailOptOuts: number
  phoneOptOuts: number
  smsOptOuts: number
  postalOptOuts: number
}) {
  const total = emailOptOuts + phoneOptOuts + smsOptOuts + postalOptOuts

  const calculatePercentage = (value: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm gradient-card">
      <div className="p-6">
        <h3 className="text-lg font-semibold">Opt-Outs by Channel</h3>
        <p className="text-sm text-juiced-gray">Distribution across channels</p>
      </div>
      <div className="p-6 pt-0 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-juiced-teal" />
              <span className="text-sm">Email</span>
            </div>
            <span className="text-sm font-medium">{calculatePercentage(emailOptOuts)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-juiced-teal rounded-full"
              style={{ width: `${calculatePercentage(emailOptOuts)}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-2 text-juiced-blue" />
              <span className="text-sm">Phone</span>
            </div>
            <span className="text-sm font-medium">{calculatePercentage(phoneOptOuts)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-juiced-blue rounded-full"
              style={{ width: `${calculatePercentage(phoneOptOuts)}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-2 text-juiced-purple" />
              <span className="text-sm">SMS</span>
            </div>
            <span className="text-sm font-medium">{calculatePercentage(smsOptOuts)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-juiced-purple rounded-full"
              style={{ width: `${calculatePercentage(smsOptOuts)}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-juiced-gray" />
              <span className="text-sm">Postal</span>
            </div>
            <span className="text-sm font-medium">{calculatePercentage(postalOptOuts)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-juiced-gray rounded-full"
              style={{ width: `${calculatePercentage(postalOptOuts)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
