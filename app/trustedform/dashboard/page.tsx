"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, FileCheck, Layers, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { CertificateCard } from "@/components/trustedform/certificate-card"
import { BatchOperationsList } from "@/components/batch/batch-operations-list"

interface DashboardStats {
  totalCertificates: number
  pendingCertificates: number
  verifiedCertificates: number
  invalidCertificates: number
  verificationSuccessRate: number
  recentCertificates: any[]
}

export default function TrustedFormDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/v1/trustedform/stats")

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats")
      console.error("Error fetching dashboard stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TrustedForm Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage TrustedForm certificates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p>Error loading dashboard stats: {error}</p>
          <Button variant="outline" className="mt-2" onClick={fetchStats}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Certificates</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCertificates || 0}</div>
                <p className="text-xs text-muted-foreground">Total certificates in the system</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Verified Certificates</CardTitle>
                <FileCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats?.verifiedCertificates || 0}</div>
                <p className="text-xs text-muted-foreground">Successfully verified certificates</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Certificates</CardTitle>
                <FileCheck className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.pendingCertificates || 0}</div>
                <p className="text-xs text-muted-foreground">Certificates waiting for verification</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Verification Success Rate</CardTitle>
                <FileCheck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.verificationSuccessRate || 0}%</div>
                <p className="text-xs text-muted-foreground">Percentage of successful verifications</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="recent">
            <TabsList>
              <TabsTrigger value="recent">Recent Certificates</TabsTrigger>
              <TabsTrigger value="batch">Batch Operations</TabsTrigger>
            </TabsList>
            <TabsContent value="recent" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Certificates</CardTitle>
                  <CardDescription>Recently added or verified TrustedForm certificates</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats?.recentCertificates && stats.recentCertificates.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {stats.recentCertificates.map((cert) => (
                        <CertificateCard key={cert.id} certificate={cert} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <p className="text-center text-muted-foreground">No certificates found</p>
                      <Button asChild className="mt-4">
                        <Link href="/trustedform/certificates">View All Certificates</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="batch" className="mt-6">
              <BatchOperationsList
                type="trustedform_verification"
                title="Recent Batch Operations"
                description="Recently created TrustedForm batch verification operations"
                limit={5}
              />
              <div className="mt-4 flex justify-end">
                <Button asChild>
                  <Link href="/trustedform/batch">
                    <Layers className="mr-2 h-4 w-4" />
                    View All Batch Operations
                  </Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
