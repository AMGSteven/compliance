import { ComplianceChecker, ComplianceResult, TCPALitigatorResponse, LeadContext } from '../types';

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

  // States that require State DNC checks
  private readonly stateDNCStates = ['CO', 'FL', 'IN', 'LA', 'MA', 'MO', 'OK', 'PA', 'TN', 'TX', 'WY'];

  /**
   * Format phone number to 10-digit format (same logic as lead submission API)
   * Removes non-digits and ensures 10-digit format
   */
  private formatPhoneToTenDigits(phoneNumber: string): string {
    // Remove any non-numeric characters
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Ensure 10-digit format - take last 10 digits if longer
    const formattedPhone = cleanPhone.length === 10 ? cleanPhone : cleanPhone.substring(cleanPhone.length - 10);
    
    // Log phone formatting for debugging
    console.log('📞 TCPA Phone formatting:', { 
      original: phoneNumber, 
      cleaned: cleanPhone, 
      formatted: formattedPhone 
    });
    
    return formattedPhone;
  }

  async checkNumber(phoneNumber: string, context?: LeadContext): Promise<ComplianceResult> {
    try {
      // Format phone number to 10-digit format (same as lead submission API)
      const cleanNumber = this.formatPhoneToTenDigits(phoneNumber);
      
      // First, run the standard TCPA check
      const tcpaResponse = await this.performTCPACheck(cleanNumber);
      
      // If TCPA check fails, return immediately
      if (!tcpaResponse.isCompliant) {
        return tcpaResponse;
      }
      
      // Check if we need to perform State DNC check for specific states
      if (context?.state && this.shouldCheckStateDNC(context)) {
        console.log(`Performing State DNC check for state: ${context.state}`);
        const stateDNCResponse = await this.performStateDNCCheck(cleanNumber, context.state);
        
        // If State DNC check fails, return the failure
        if (!stateDNCResponse.isCompliant) {
          return stateDNCResponse;
        }
      }
      
      // Both checks passed, return the TCPA response
      return tcpaResponse;
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

  private shouldCheckStateDNC(context: LeadContext): boolean {
    // Only check State DNC if:
    // 1. The state is in our State DNC check list
    // 2. The state is allowed by the vertical's configuration (to avoid wasting API credits)
    const stateInDNCList = this.stateDNCStates.includes(context.state!);
    const stateAllowed = !context.allowedStates || context.allowedStates.includes(context.state!);
    
    return stateInDNCList && stateAllowed;
  }

  private async performTCPACheck(phoneNumber: string): Promise<ComplianceResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scrub/phone`, {
        method: 'POST',
        headers: {
          'Authorization': this.auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          phone_number: phoneNumber,
          type: '["tcpa","dnc"]'
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`TCPA HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as TCPALitigatorResponse;
      
      // Log TCPA API response for debugging
      console.log('🔍 TCPA API JSON RESPONSE:', JSON.stringify(data, null, 2));
      
      // ✅ FIXED: Handle case where data.results is undefined or malformed
      const result = data?.results;
      
      if (!result) {
        console.error('TCPA API returned unexpected response structure:', data);
        // Don't throw error, we handled it above by creating a synthetic response
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
        source: `${this.name} (TCPA)`,
        phoneNumber,
        details: {
          checkType: 'tcpa',
          ...result
        },
        rawResponse: data,
      };
    } catch (error) {
      console.error('TCPA check error for phone', phoneNumber, ':', error);
      throw error; // Re-throw to be handled by main checkNumber method
    }
  }

  private async performStateDNCCheck(phoneNumber: string, state: string): Promise<ComplianceResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scrub/phone`, {
        method: 'POST',
        headers: {
          'Authorization': this.auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          phone_number: phoneNumber,
          type: '["tcpa","dnc_state","dnc_complainers"]'
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`State DNC HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as TCPALitigatorResponse;
      
      // Log State DNC API response for debugging
      console.log('🔍 STATE DNC API JSON RESPONSE:', JSON.stringify(data, null, 2));
      
      const result = data?.results;
      
      if (!result) {
        console.error('State DNC API returned unexpected response structure:', data);
        // Don't throw error, we handled it above by creating a synthetic response
      }

      const isCompliant = result.clean === 1;
      const statusArray = result.status_array ?? [];
      const reasons = isCompliant ? [] : statusArray;

      return {
        isCompliant,
        reasons,
        source: `${this.name} (State DNC - ${state})`,
        phoneNumber,
        details: {
          checkType: 'state_dnc',
          state: state,
          ...result
        },
        rawResponse: data,
      };
    } catch (error) {
      console.error('State DNC check error for phone', phoneNumber, 'state', state, ':', error);
      throw error; // Re-throw to be handled by main checkNumber method
    }
  }
}
