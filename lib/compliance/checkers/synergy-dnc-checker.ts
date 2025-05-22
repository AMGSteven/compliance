import { ComplianceChecker, ComplianceResult } from '../types';

export class SynergyDNCChecker implements ComplianceChecker {
  name = 'Synergy DNC';
  private apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/rtb/ping';

  /**
   * Formats a phone number for API request
   * @param phoneNumber Phone number to format
   * @returns Formatted phone number (digits only)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * Check if a phone number is on the Synergy DNC list
   * @param phoneNumber Phone number to check
   * @returns ComplianceResult indicating if the number is compliant
   */
  async checkNumber(phoneNumber: string): Promise<ComplianceResult> {
    try {
      console.log(`[SynergyDNCChecker] Checking number: ${phoneNumber}`);
      
      // Format the phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Make the API request to check if caller ID is on Synergy DNC
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caller_id: formattedPhone
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Synergy DNC API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[SynergyDNCChecker] API response:`, data);
      
      // Determine if the number is on the DNC list by checking the rejection_reason
      // API will return rejection_reason: "internal_dnc" if the number is on the DNC list
      const isOnDNC = data?.rejection_reason === 'internal_dnc';
      console.log(`[SynergyDNCChecker] DNC check for ${formattedPhone}: ${isOnDNC ? 'ON DNC LIST' : 'Not on DNC list'}`);
      console.log(`[SynergyDNCChecker] Rejection reason: ${data?.rejection_reason}`);
      
      const isCompliant = !isOnDNC;
      
      // Create reasons array if the number is not compliant
      const reasons = isOnDNC ? ['Number found on Synergy DNC list (rejection_reason: internal_dnc)'] : [];
      
      return {
        isCompliant,
        reasons,
        source: this.name,
        details: { isOnDNC },
        phoneNumber,
        rawResponse: data,
      };
    } catch (error) {
      console.error(`[SynergyDNCChecker] Error:`, error);
      
      // On error, we return compliant (fail open) but with an error message
      return {
        isCompliant: true, // Fail open
        reasons: [`Error checking Synergy DNC: ${error instanceof Error ? error.message : 'Unknown error'}`],
        source: this.name,
        details: {},
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
