import { ComplianceChecker, ComplianceResult, TCPALitigatorResponse } from '../types';

export class TCPAChecker implements ComplianceChecker {
  private readonly baseUrl = 'https://api.tcpalitigatorlist.com';
  private readonly auth: string;
  name = 'TCPA Litigator List';

  constructor() {
    const username = process.env.TCPA_USERNAME;
    const password = process.env.TCPA_PASSWORD;
    
    if (!username || !password) {
      throw new Error('TCPA_USERNAME and TCPA_PASSWORD environment variables are required');
    }
    
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    this.auth = `Basic ${credentials}`;
  }

  async checkNumber(phoneNumber: string): Promise<ComplianceResult> {
    try {
      // Remove any non-numeric characters from the phone number
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      const response = await fetch(`${this.baseUrl}/scrub/phone`, {
        method: 'POST',
        headers: {
          'Authorization': this.auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          phone_number: cleanNumber,
          type: '["tcpa","dnc"]'
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as TCPALitigatorResponse;
      
      // ✅ FIXED: Handle case where data.results is undefined or malformed
      const result = data?.results;
      
      if (!result) {
        console.error('TCPA API returned unexpected response structure:', data);
        throw new Error('TCPA API returned unexpected response structure');
      }

      // ✅ FIXED: Use result.clean === 1 as primary compliance indicator
      // Clean numbers (clean=1) don't have status_array field at all
      // Dirty numbers (clean=0) have status_array with reasons
      const isCompliant = result.clean === 1;
      const statusArray = result.status_array ?? [];
      const reasons = isCompliant ? [] : statusArray;

      return {
        isCompliant,
        reasons,
        source: this.name,
        phoneNumber,
        details: {
          ...result
        },
        rawResponse: data,
      };
    } catch (error) {
      console.error('TCPA check error for phone', phoneNumber, ':', error);
      return {
        isCompliant: false,
        reasons: [],
        source: this.name,
        phoneNumber,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
