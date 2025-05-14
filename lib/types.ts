export type Contact = {
  id: string
  email?: string
  phone?: string
  postal?: string
  ip_address?: string
  created_at: string
  updated_at: string
}

export type OptOut = {
  id: string
  contact_id: string
  channel: "email" | "phone" | "sms" | "postal" | "all"
  source: string
  reason?: string
  opt_out_date: string
  expiration_date?: string
  metadata?: Record<string, any>
  created_at: string
}

export type ComplianceVerification = {
  id: string
  contact_id: string
  verification_type: "trustedform" | "tcpa" | "consent" | "age"
  verification_token?: string
  verification_url?: string
  verification_date: string
  expiration_date?: string
  status: "valid" | "invalid" | "expired"
  metadata?: Record<string, any>
  created_at: string
}

export type ApiRequest = {
  id: string
  endpoint: string
  method: string
  request_data?: Record<string, any>
  response_data?: Record<string, any>
  status_code?: number
  latency?: number
  ip_address?: string
  user_agent?: string
  timestamp: string
}

export type ComplianceEvent = {
  id: string
  event_type: "check" | "validation" | "opt-out" | "reinstatement"
  status: "pass" | "fail" | "warning"
  contact_id?: string
  details?: Record<string, any>
  timestamp: string
}

export type SuppressionCheckRequest = {
  email?: string
  phone?: string
  postal?: string
  channel?: "email" | "phone" | "sms" | "postal" | "all"
}

export type SuppressionCheckResponse = {
  suppressed: boolean
  details: {
    email?: boolean
    phone?: boolean
    postal?: boolean
  }
  timestamp: string
  requestId: string
}

export type OptOutRequest = {
  identifier: string
  identifierType: "email" | "phone" | "postal"
  channel: "email" | "phone" | "sms" | "postal" | "all"
  source: string
  reason?: string
  metadata?: Record<string, any>
}

export type BatchSuppressionCheckRequest = {
  contacts: {
    id?: string
    email?: string
    phone?: string
    postal?: string
  }[]
  channel?: "email" | "phone" | "sms" | "postal" | "all"
}

export type BatchSuppressionCheckResponse = {
  timestamp: string
  requestId: string
  totalProcessed: number
  totalSuppressed: number
  results: {
    id?: string
    suppressed: boolean
    details: {
      email?: boolean
      phone?: boolean
      postal?: boolean
    }
  }[]
}

export type DashboardStats = {
  totalContacts: number
  totalOptOuts: number
  emailOptOuts: number
  phoneOptOuts: number
  smsOptOuts: number
  postalOptOuts: number
  complianceRate: number
  recentOptOuts: OptOutWithContact[]
}

export type OptOutWithContact = OptOut & {
  contact: Contact
}
