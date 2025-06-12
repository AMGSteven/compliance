/**
 * Direct implementation of phone validation that guarantees VoIP blocking
 */

// API configuration - using the key from environment variables
const API_KEY = process.env.REAL_PHONE_VALIDATION_API_KEY || '2699AA84-6478-493F-BF14-299F89BA9719';
const API_URL = 'https://api.realvalidation.com/rpvWebService/Turbo.php';

// Simple interface for validation results
interface ValidationResult {
  isValid: boolean;
  reason?: string;
  details: {
    phoneType?: string;
    isVoIP?: boolean;
    status?: string;
    [key: string]: any;
  };
}

/**
 * Direct check to the RealPhoneValidation API
 * This is a simplified implementation guaranteed to block VoIP numbers
 */
export async function directCheckPhone(phoneNumber: string): Promise<ValidationResult> {
  try {
    console.log(`[DIRECT] Checking phone: ${phoneNumber}`);
    
    // Format phone number - strip non-digits
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // API parameters per documentation
    const params = new URLSearchParams({
      token: API_KEY,
      phone: formattedPhone,
      output: 'json' // Per API docs
    });
    
    // Make the API request directly
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`[DIRECT] API error: ${response.status}`);
      return {
        isValid: false,
        reason: `API request failed with status ${response.status}`,
        details: { error: response.statusText }
      };
    }
    
    // Parse the response
    const responseText = await response.text();
    console.log(`[DIRECT] API Response: ${responseText}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[DIRECT] JSON parse error:', e);
      return {
        isValid: false,
        reason: 'Failed to parse API response',
        details: { error: 'Invalid JSON' }
      };
    }
    
    // Check if it's VoIP - THIS IS THE CRITICAL PART
    const isVoIP = data.phone_type?.toLowerCase() === 'voip';
    console.log(`[DIRECT] Is VoIP check: ${isVoIP}, phone_type: ${data.phone_type}`);
    
    // Check if the phone is disconnected or has other issues
    const isBadStatus = ['disconnected', 'disconnected-70', 'unreachable', 'invalid phone', 'restricted', 'busy']
      .includes(data.status?.toLowerCase());
    
    // The phone is only valid if it's not VoIP AND has a good status
    const isValid = !isVoIP && !isBadStatus;
    
    if (isVoIP) {
      console.log(`[DIRECT] BLOCKING: VoIP number detected: ${phoneNumber}`);
      return {
        isValid: false,
        reason: 'VoIP numbers are not allowed',
        details: {
          phoneType: data.phone_type,
          isVoIP: true,
          status: data.status
        }
      };
    }
    
    if (isBadStatus) {
      console.log(`[DIRECT] BLOCKING: Bad status: ${data.status}`);
      return {
        isValid: false,
        reason: `Phone has invalid status: ${data.status}`,
        details: {
          phoneType: data.phone_type,
          isVoIP: false,
          status: data.status
        }
      };
    }
    
    // If we get here, the phone passed validation
    return {
      isValid: true,
      details: {
        phoneType: data.phone_type,
        isVoIP: false,
        status: data.status
      }
    };
    
  } catch (error) {
    console.error('[DIRECT] Error in phone validation:', error);
    return {
      isValid: false,
      reason: 'System error during validation',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}
