export interface ComplianceResult {
  isCompliant: boolean;
  reasons: string[];
  source: string;
  details: any;
  phoneNumber: string;
  rawResponse?: any;
  error?: string;
}

export interface ComplianceReport {
  phoneNumber: string;
  isCompliant: boolean;
  results: ComplianceResult[];
  timestamp: string;
}

export interface ComplianceChecker {
  checkNumber(phoneNumber: string): Promise<ComplianceResult>;
  name: string;
}

export interface TCPALitigatorResponse {
  results: {
    clean: number;
    is_bad_number: boolean;
    status_array: string[];
    phone_number: string;
  };
}

export interface BlacklistAllianceResponse {
  sid: string;
  status: string;
  message: string;
  code: string;
  offset: number;
  phone: string;
  results: number;
  time: number;
  carrier?: {
    did: string;
    type: string;
    name: string;
    state: string;
    ratecenter: string;
    country: string;
    clli: string;
    lata: string;
    wireless: string;
    lrn: string;
    npa: string;
    nxx: string;
    nxxx: string;
    ocn: string;
    port_type: string;
  };
  scrubs: boolean;
}

export interface WebreconResponse {
  success: boolean;
  match: boolean;
  matchType?: string;
  dateFound?: string;
}

export interface EmailOptOutEntry {
  email: string;
  first_name?: string;
  last_name?: string;
  reason?: string;
  source?: string;
  added_by?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export interface EmailOptInEntry {
  email: string;
  first_name?: string;
  last_name?: string;
  source?: string;
  added_by?: string;
  consent_details?: string;
  status?: string;
  metadata?: Record<string, any>;
}
