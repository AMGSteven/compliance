import { type NextRequest, NextResponse } from "next/server"

export async function validateApiKey(request: NextRequest, requiredScopes?: string[]) {
  // Log the request for debugging
  console.log('Validating API key, headers:', Object.fromEntries(request.headers.entries()));
  
  // Extract API key from headers - supporting multiple common formats
  const apiKey = request.headers.get("X-API-Key") || 
                request.headers.get("Api-Key") || 
                request.headers.get("Authorization")?.replace("Bearer ", "");

  // Log the found API key
  console.log('API key found:', apiKey);

  if (!apiKey) {
    return {
      valid: false,
      error: "API key is required",
      status: 401
    }
  }

  // Directly validate against environment variable for simplicity
  // In production, this should use a more secure validation method
  const validKeys = (process.env.DIALER_API_KEYS || "test_key_123").split(",");
  console.log('Valid keys array:', validKeys);
  
  if (!validKeys.includes(apiKey)) {
    console.log('Invalid API key:', apiKey);
    return {
      valid: false,
      error: "Invalid API key",
      status: 401
    }
  }
  
  // For simplicity, we'll assume all valid keys have all permissions
  // In a real implementation, you would check scopes against a database
  console.log('API key is valid');
  
  return { 
    valid: true, 
    apiKey: {
      key: apiKey,
      permissions: {
        read: true,
        write: true
      }
    }
  }
}
