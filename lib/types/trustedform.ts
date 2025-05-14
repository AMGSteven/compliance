export type TrustedFormCertificate = {
  id: string
  certificateUrl: string
  contactId: string
  status: "pending" | "verified" | "invalid"
  verifiedAt?: string
  createdAt: string
  expiresAt?: string
  metadata?: Record<string, any>
}

export type CertificateVerification = {
  id: string
  certificateId: string
  verificationResult: Record<string, any>
  matchStatus: boolean
  verifiedAt: string
  verifiedBy: string
}

export type TrustedFormVerifyRequest = {
  certificateUrl: string
  leadData: {
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
  }
  referenceId: string
  vendor?: string
}

export type TrustedFormVerifyResponse = {
  success: boolean
  certificate?: {
    id: string
    created_at: string
    expires_at: string
    fingerprints?: string[]
    geo?: {
      city?: string
      country_code?: string
      lat?: number
      lon?: number
      postal_code?: string
      state?: string
      time_zone?: string
    }
    ip?: string
    page_url?: string
    scan_results?: {
      found?: string[]
      not_found?: string[]
    }
    share_url?: string
    masked_cert_url?: string
    warnings?: string[]
    matching?: {
      email?: boolean
      phone?: boolean
    }
  }
  errors?: string[]
  warnings?: string[]
}

export type TrustedFormCertificateWithContact = TrustedFormCertificate & {
  contact: {
    id: string
    email?: string
    phone?: string
  }
}

export type TrustedFormCertificateWithVerifications = TrustedFormCertificate & {
  verifications: CertificateVerification[]
}

export type TrustedFormDashboardStats = {
  totalCertificates: number
  pendingCertificates: number
  verifiedCertificates: number
  invalidCertificates: number
  verificationSuccessRate: number
  recentCertificates: TrustedFormCertificateWithContact[]
}

// New types for batch operations
export type BatchOperation = {
  id: string
  type: "verification" | "capture"
  status: "pending" | "processing" | "completed" | "failed"
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  createdBy: string
  metadata?: Record<string, any>
}

export type BatchVerificationRequest = {
  items: Array<{
    certificateId?: string
    certificateUrl?: string
    leadData?: {
      email?: string
      phone?: string
      firstName?: string
      lastName?: string
    }
  }>
  referenceId?: string
  vendor?: string
}

export type BatchVerificationResult = {
  batchId: string
  status: "pending" | "processing" | "completed" | "failed"
  totalItems: number
  processedItems: number
  successfulItems: number
  failedItems: number
  results?: Array<{
    certificateId: string
    success: boolean
    status?: "verified" | "invalid" | "pending"
    message?: string
  }>
}

export type BatchOperationWithResults = BatchOperation & {
  results: Array<{
    itemId: string
    success: boolean
    message?: string
    data?: Record<string, any>
  }>
}
