

"use client"

// Force dynamic rendering instead of static generation
export const dynamic = 'force-dynamic';
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CertificateStatusBadge } from "@/components/trustedform/certificate-status-badge"
import { formatDateTime } from "@/lib/utils"
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react"
import type { TrustedFormCertificateWithVerifications } from "@/lib/types/trustedform"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function CertificateDetailsPage({ params }: { params: { id: string } }) {
  const [certificate, setCertificate] = useState<TrustedFormCertificateWithVerifications | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchCertificate()
  }, [params.id])

  const fetchCertificate = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/trustedform/certificates/${params.id}`)

      if (response.status === 404) {
        setError("Certificate not found")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch certificate details")
      }

      const data = await response.json()
      setCertificate(data.certificate)
    } catch (err) {
      console.error("Error fetching certificate details:", err)
      setError("Failed to load certificate details")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    try {
      setVerifying(true)
      const response = await fetch("/api/v1/trustedform/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ certificateId: params.id }),
      })

      if (!response.ok) {
        throw new Error("Failed to verify certificate")
      }

      // Refresh the certificate details
      fetchCertificate()
    } catch (err) {
      console.error("Error verifying certificate:", err)
      alert("Failed to verify certificate")
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-10">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform/certificates">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Certificate Details</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-lg">Loading certificate details...</p>
        </div>
      </main>
    )
  }

  if (error || !certificate) {
    return (
      <main className="container mx-auto py-10">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform/certificates">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Certificate Details</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-lg text-red-500">{error || "Certificate not found"}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" className="mr-4" asChild>
            <Link href="/trustedform/certificates">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Certificate Details</h1>
        </div>
        <div className="flex items-center space-x-2">
          <CertificateStatusBadge status={certificate.status} />
          {certificate.status === "pending" && (
            <Button onClick={handleVerify} disabled={verifying}>
              {verifying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Now"
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Certificate Information</CardTitle>
            <CardDescription>Details about this TrustedForm certificate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Certificate URL</h3>
              <div className="flex items-center">
                <p className="font-mono text-xs break-all">{certificate.certificateUrl}</p>
                <a
                  href={certificate.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Status</h3>
              <p>{certificate.status}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Created At</h3>
              <p>{formatDateTime(certificate.createdAt)}</p>
            </div>
            {certificate.verifiedAt && (
              <div>
                <h3 className="text-sm font-medium mb-1">Verified At</h3>
                <p>{formatDateTime(certificate.verifiedAt)}</p>
              </div>
            )}
            {certificate.expiresAt && (
              <div>
                <h3 className="text-sm font-medium mb-1">Expires At</h3>
                <p>{formatDateTime(certificate.expiresAt)}</p>
              </div>
            )}
            {certificate.metadata?.page_url && (
              <div>
                <h3 className="text-sm font-medium mb-1">Page URL</h3>
                <p className="font-mono text-xs break-all">{certificate.metadata.page_url}</p>
              </div>
            )}
            {certificate.metadata?.ip && (
              <div>
                <h3 className="text-sm font-medium mb-1">IP Address</h3>
                <p>{certificate.metadata.ip}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Contact associated with this certificate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Contact ID</h3>
              <p className="font-mono text-xs">{certificate.contactId}</p>
            </div>
            {certificate.contact?.email && (
              <div>
                <h3 className="text-sm font-medium mb-1">Email</h3>
                <p>{certificate.contact.email}</p>
              </div>
            )}
            {certificate.contact?.phone && (
              <div>
                <h3 className="text-sm font-medium mb-1">Phone</h3>
                <p>{certificate.contact.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {certificate.verifications && certificate.verifications.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Verification History</CardTitle>
            <CardDescription>Record of verification attempts for this certificate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {certificate.verifications.map((verification) => (
                <div key={verification.id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between mb-2">
                    <h3 className="font-medium">
                      Verified by {verification.verifiedBy} on {formatDateTime(verification.verifiedAt)}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        verification.matchStatus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {verification.matchStatus ? "Matched" : "Not Matched"}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(verification.verificationResult, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
