/**
 * Direct phone validation hook that ensures VoIP numbers are blocked
 * This file serves as a guaranteed way to check phone types and block VoIP numbers
 */

// Simple function to make a direct API call to RealPhoneValidation Turbo API
export async function validatePhoneDirectly(phoneNumber: string): Promise<{
  isValid: boolean;
  reason?: string;
  phoneType?: string;
  status?: string;
}> {
  const API_KEY = process.env.REAL_PHONE_VALIDATION_API_KEY || '2699AA84-6478-493F-BF14-299F89BA9719';
  const API_URL = 'https://api.realvalidation.com/rpvWebService/Turbo.php';
  
  try {
    // Clean the phone number
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Build API request URL with parameters
    const params = new URLSearchParams({
      token: API_KEY,
      phone: formattedPhone,
      output: 'json'
    });
    
    const url = `${API_URL}?${params.toString()}`;
    console.log(`[DIRECT VALIDATION] Calling API: ${url}`);
    
    // Make direct fetch request to API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    // Parse the response
    const responseText = await response.text();
    console.log(`[DIRECT VALIDATION] Raw API response: ${responseText}`);
    
    const data = JSON.parse(responseText);
    
    // CRITICAL: Check if this is a VoIP number - the API returns "VoIP" as the phone_type
    const isVoIP = data.phone_type?.toLowerCase() === 'voip';
    
    // Also check for bad statuses - making sure to match the exact statuses returned by the API
    const badStatuses = ['disconnected', 'disconnected-70', 'unreachable', 'invalid phone', 'invalid-phone', 'restricted', 'busy', 'error'];
    const hasBadStatus = badStatuses.includes(data.status?.toLowerCase()) || 
                         (data.error_text && data.error_text.toLowerCase().includes('not valid'));
    
    if (isVoIP) {
      console.log(`[DIRECT VALIDATION] REJECTED: Phone ${phoneNumber} is a VoIP number (${data.phone_type})`);
      return {
        isValid: false,
        reason: 'VoIP numbers are not allowed',
        phoneType: data.phone_type,
        status: data.status
      };
    }
    
    if (hasBadStatus) {
      console.log(`[DIRECT VALIDATION] REJECTED: Phone ${phoneNumber} has bad status (${data.status})`);
      return {
        isValid: false,
        reason: `Phone has invalid status: ${data.status}`,
        phoneType: data.phone_type,
        status: data.status
      };
    }
    
    // If we get here, the phone passes validation
    console.log(`[DIRECT VALIDATION] APPROVED: Phone ${phoneNumber} is valid (${data.phone_type})`);
    return {
      isValid: true,
      phoneType: data.phone_type,
      status: data.status
    };
  } catch (error) {
    console.error('[DIRECT VALIDATION] Error:', error);
    return {
      isValid: false,
      reason: 'Error validating phone number'
    };
  }
}
