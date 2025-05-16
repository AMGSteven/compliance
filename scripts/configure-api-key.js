/**
 * Temporary script to add a test API key to environment
 */

// Set a temporary API key for testing
process.env.DIALER_API_KEYS = 'test-api-key-123';

console.log('Test API key configured:', process.env.DIALER_API_KEYS);

// Export the key
export const API_KEY = 'test-api-key-123';
