import { ComplianceChecker, ComplianceResult, LeadContext } from '../types';

export class SynergyDNCChecker implements ComplianceChecker {
  name = 'Synergy DNC';
  private apiUrl = 'https://izem71vgk8.execute-api.us-east-1.amazonaws.com/api/blacklist/check';

  /**
   * Formats a phone number for API request
   * @param phoneNumber Phone number to format
   * @returns Formatted phone number (digits only for query parameter)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Return digits only for query parameter
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * Check if a phone number is on the Synergy DNC list
   * @param phoneNumber Phone number to check
   * @returns ComplianceResult indicating if the number is compliant
   */
  async checkNumber(phoneNumber: string, context?: LeadContext): Promise<ComplianceResult> {
    const maxRetries = 3;
    const retryDelayMs = 1000; // 1 second between retries
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SynergyDNCChecker] Checking number: ${phoneNumber} (attempt ${attempt}/${maxRetries})`);
        
        // Format the phone number (digits only for query parameter)
        const formattedPhone = this.formatPhoneNumber(phoneNumber);
        
        // Build the URL with query parameter
        const url = `${this.apiUrl}?phone_number=${encodeURIComponent(formattedPhone)}`;
        
        // Make the API request to check if phone number is on Synergy DNC
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Add timeout of 10 seconds
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          throw new Error(`Synergy DNC API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[SynergyDNCChecker] API response:`, data);
        
        // Check for ALL rejection reasons that should block the number
        const rejectionReason = data?.rejection_reason;
        const isRejected = this.shouldRejectNumber(rejectionReason);
        
        console.log(`[SynergyDNCChecker] DNC check for ${formattedPhone}: ${isRejected ? 'REJECTED' : 'ACCEPTED'}`);
        console.log(`[SynergyDNCChecker] Rejection reason: ${rejectionReason || 'none'}`);
        
        const isCompliant = !isRejected;
        
        // Create detailed reasons array if the number is not compliant
        const reasons = isRejected ? [this.getRejectionMessage(rejectionReason)] : [];
        
        return {
          isCompliant,
          reasons,
          source: this.name,
          details: { 
            rejectionReason,
            isRejected,
            attempt 
          },
          phoneNumber,
          rawResponse: data,
        };
        
      } catch (error) {
        console.error(`[SynergyDNCChecker] Attempt ${attempt} failed:`, error);
        
        // If this is the last attempt, fail closed (reject the number)
        if (attempt === maxRetries) {
          console.error(`[SynergyDNCChecker] All ${maxRetries} attempts failed. FAILING CLOSED.`);
          return {
            isCompliant: false, // FAIL CLOSED - reject on error
            reasons: [`Synergy DNC check failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`],
            source: this.name,
            details: { 
              error: error instanceof Error ? error.message : 'Unknown error',
              attempts: maxRetries,
              failedClosed: true
            },
            phoneNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
        
        // Wait before retrying (unless it's the last attempt)
        if (attempt < maxRetries) {
          console.log(`[SynergyDNCChecker] Retrying in ${retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    
    // This should never be reached, but fail closed if it somehow does
    return {
      isCompliant: false,
      reasons: ['Unexpected error in Synergy DNC checker'],
      source: this.name,
      details: { unexpectedError: true },
      phoneNumber,
    };
  }

  /**
   * Determine if a rejection reason should block the number
   */
  private shouldRejectNumber(rejectionReason: string | null | undefined): boolean {
    if (!rejectionReason) {
      return false; // No rejection reason means accepted
    }
    
    // List of rejection reasons that should block the number
    const blockingReasons = [
      'internal_dnc',           // On DNC list
      'litigator',              // Known litigator
      'tcpa_litigator',         // TCPA litigator
      'dnc',                    // General DNC
      'federal_dnc',            // Federal DNC
      'state_dnc',              // State DNC
      'carrier_dnc',            // Carrier DNC
      'blacklist',              // Blacklisted number
      'fraud',                  // Fraud number
      'invalid_number',         // Invalid phone number
      'disconnected',           // Disconnected number
      'landline_only',          // Landline only (if you only want mobile)
      'robocall_flag',          // Flagged for robocalls
    ];
    
    // Check if the rejection reason matches any blocking reason
    return blockingReasons.includes(rejectionReason.toLowerCase());
  }

  /**
   * Get a human-readable message for the rejection reason
   */
  private getRejectionMessage(rejectionReason: string): string {
    const messages: Record<string, string> = {
      'internal_dnc': 'Number found on Synergy DNC list',
      'litigator': 'Number belongs to known litigator',
      'tcpa_litigator': 'Number belongs to TCPA litigator', 
      'dnc': 'Number on Do Not Call list',
      'federal_dnc': 'Number on Federal DNC list',
      'state_dnc': 'Number on State DNC list',
      'carrier_dnc': 'Number on Carrier DNC list',
      'blacklist': 'Number is blacklisted',
      'fraud': 'Number flagged for fraud',
      'invalid_number': 'Invalid phone number',
      'disconnected': 'Disconnected phone number',
      'landline_only': 'Landline only number',
      'robocall_flag': 'Number flagged for robocalls',
    };
    
    return messages[rejectionReason.toLowerCase()] || `Number rejected: ${rejectionReason}`;
  }
}
