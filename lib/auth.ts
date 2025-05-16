/**
 * Validates an API key against configured dialer API keys
 */
export async function validateApiKey(apiKey: string | null): Promise<boolean> {
  console.log('=== API KEY VALIDATION DEBUG ===');
  console.log('Validating API key:', apiKey);
  console.log('Node environment:', process.env.NODE_ENV);
  console.log('DIALER_API_KEYS env variable exists:', !!process.env.DIALER_API_KEYS);
  
  if (!apiKey) {
    console.log('No API key provided');
    return false;
  }

  // Always log test key matches
  console.log('Input key matches test_key_123:', apiKey === 'test_key_123');
  
  // For development/testing, always accept test_key_123
  if (apiKey === 'test_key_123') {
    console.log('Using test API key');
    return true;
  }

  // Get configured API keys from environment
  const configuredKeysString = process.env.DIALER_API_KEYS || '';
  console.log('Raw configured keys string:', configuredKeysString);
  
  const configuredKeys = configuredKeysString.split(',').map(k => k.trim()).filter(Boolean);
  console.log('Parsed configured API keys:', configuredKeys);
  console.log('Number of configured keys:', configuredKeys.length);
  
  const isValid = configuredKeys.includes(apiKey);
  console.log('API key validation result:', isValid);
  
  return isValid;
}
