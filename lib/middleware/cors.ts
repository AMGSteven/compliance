import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// CORS headers for use in API routes
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Api-Key",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400", // 24 hours
}

// List of allowed origins (your lead gen domains)
const allowedOrigins = [
  "https://example.com",
  "https://example.org",
  "https://yourleadsite1.com",
  "https://yourleadsite2.com",
  // Add all your lead gen domains here
  // For development
  "http://localhost:3000",
  "http://localhost:3001",
]

export function corsMiddleware(request: NextRequest) {
  // Get the origin from the request headers
  const origin = request.headers.get("origin") || ""

  // Check if the origin is in the allowed list or if we're allowing all origins with '*'
  const isAllowedOrigin = allowedOrigins.includes(origin) || allowedOrigins.includes("*")

  // Create a response object to modify
  const response = NextResponse.next()

  // Set CORS headers if the origin is allowed
  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Api-Key")
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Max-Age", "86400") // 24 hours
  }

  return response
}

// Handle OPTIONS requests for preflight
export function handleOptions(request: NextRequest) {
  const origin = request.headers.get("origin") || ""
  const isAllowedOrigin = allowedOrigins.includes(origin) || allowedOrigins.includes("*")

  if (request.method === "OPTIONS" && isAllowedOrigin) {
    const response = new NextResponse(null, { status: 204 }) // No content

    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Api-Key")
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Max-Age", "86400") // 24 hours

    return response
  }

  return NextResponse.next()
}
