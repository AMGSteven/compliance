/**
 * Validates an API key against configured dialer API keys
 */
export async function validateApiKey(apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false;

  // Get configured API keys from environment
  const configuredKeys = process.env.DIALER_API_KEYS?.split(',') || [];
  return configuredKeys.includes(apiKey);
}
