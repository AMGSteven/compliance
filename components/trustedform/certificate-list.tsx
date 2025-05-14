"use client"

import { useState } from "react"
import { CertificateCard } from "@/components/trustedform/certificate-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import type { TrustedFormCertificateWithContact } from "@/lib/types/trustedform"

interface CertificateListProps {
  certificates: TrustedFormCertificateWithContact[]
  onVerify?: (certificateId: string) => void
  showSearch?: boolean
  showPagination?: boolean
  title?: string
  description?: string
}

export function CertificateList({
  certificates,
  onVerify,
  showSearch = true,
  showPagination = true,
  title = "Certificates",
  description,
}: CertificateListProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredCertificates = certificates.filter((cert) => {
    const searchLower = searchTerm.toLowerCase()
    const email = cert.contact?.email?.toLowerCase() || ""
    const phone = cert.contact?.phone?.toLowerCase() || ""
    const certUrl = cert.certificateUrl.toLowerCase()

    return email.includes(searchLower) || phone.includes(searchLower) || certUrl.includes(searchLower)
  })

  return (
    <div className="space-y-4">
      {(title || showSearch) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}
          {showSearch && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search certificates..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {filteredCertificates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No certificates found</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCertificates.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} onVerify={onVerify} />
          ))}
        </div>
      )}

      {showPagination && filteredCertificates.length > 0 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
