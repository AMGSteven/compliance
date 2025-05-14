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
  status: string;
  found: boolean;
  details?: {
    reason: string;
    date_added: string;
  };
}

export interface WebreconResponse {
  success: boolean;
  match: boolean;
  matchType?: string;
  dateFound?: string;
}
