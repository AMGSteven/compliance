"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CertificateStatusBadge } from "@/components/trustedform/certificate-status-badge"
import { Calendar, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { TrustedFormCertificate } from "@/lib/types/trustedform"

interface CertificateCardProps {
  certificate: TrustedFormCertificate
  onVerify?: (id: string) => void
  isVerifying?: boolean
}

export function CertificateCard({ certificate, onVerify, isVerifying }: CertificateCardProps) {
  const formattedDate = new Date(certificate.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return (
    <Card className="gradient-card hover-lift">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg truncate max-w-[70%]">
            Certificate {certificate.id.substring(0, 8)}...
          </CardTitle>
          <CertificateStatusBadge status={certificate.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center text-sm text-juiced-gray">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{formattedDate}</span>
          </div>
          <p className="text-sm truncate">
            <span className="font-medium">URL:</span>{" "}
            <a
              href={certificate.certificate_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-juiced-blue hover:underline truncate inline-flex items-center"
            >
              {certificate.certificate_url.substring(0, 30)}...
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2">
        <Button variant="outline" size="sm" asChild className="hover-lift">
          <Link href={`/trustedform/certificates/${certificate.id}`}>View Details</Link>
        </Button>
        {certificate.status === "pending" && onVerify && (
          <Button
            variant="gradient"
            size="sm"
            onClick={() => onVerify(certificate.id)}
            disabled={isVerifying}
            className="pulse-on-hover"
          >
            {isVerifying ? "Verifying..." : "Verify Now"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
