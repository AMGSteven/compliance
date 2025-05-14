"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CertificateCard } from "@/components/trustedform/certificate-card"
import { Search, ArrowLeft } from "lucide-react"
import type { TrustedFormCertificateWithContact } from "@/lib/types/trustedform"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<TrustedFormCertificateWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [verifying, setVerifying] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchCertificates()
  }, [page, statusFilter])

  const fetchCertificates = async () => {
    try {
      setLoading(true)
      let url = `/api/v1/trustedform/certificates?page=${page}&limit=12`

      if (statusFilter) {
        url += `&status=${statusFilter}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch certificates")
      }

      const data = await response.json()
      setCertificates(data.certificates)
      setTotalPages(data.pagination.pages)
    } catch (err) {
      console.error("Error fetching certificates:", err)
      setError("Failed to load certificates")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (certificateId: string) => {
    try {
      setVerifying(certificateId)
      const response = await fetch("/api/v1/trustedform/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ certificateId }),
      })

      if (!response.ok) {
        throw new Error("Failed to verify certificate")
      }

      // Refresh the certificates list
      fetchCertificates()
    } catch (err) {
      console.error("Error verifying certificate:", err)
      alert("Failed to verify certificate")
    } finally {
      setVerifying(null)
    }
  }

  const filteredCertificates = certificates.filter((cert) => {
    const searchLower = searchTerm.toLowerCase()
    const email = cert.contact?.email?.toLowerCase() || ""
    const phone = cert.contact?.phone?.toLowerCase() || ""
    const certUrl = cert.certificateUrl.toLowerCase()

    return email.includes(searchLower) || phone.includes(searchLower) || certUrl.includes(searchLower)
  })

  if (loading && page === 1) {
    return (
      <main className="container mx-auto py-10">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">TrustedForm Certificates</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading certificates...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="container mx-auto py-10">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">TrustedForm Certificates</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-lg text-red-500">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-10">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="icon" className="mr-4" asChild>
          <Link href="/trustedform">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">TrustedForm Certificates</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Certificates</CardTitle>
          <CardDescription>Search and filter TrustedForm certificates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by email, phone, or certificate URL..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {filteredCertificates.length === 0 ? (
          <p className="col-span-full text-center py-8 text-muted-foreground">
            No certificates found matching your criteria
          </p>
        ) : (
          filteredCertificates.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} onVerify={handleVerify} />
          ))
        )}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1 || loading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </main>
  )
}
