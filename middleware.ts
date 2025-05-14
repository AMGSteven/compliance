import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsMiddleware, handleOptions } from "./lib/middleware/cors"
import { validateApiKey } from "./lib/middleware/api-key-middleware"

export async function middleware(request: NextRequest) {
  // Handle OPTIONS requests for CORS preflight
  if (request.method === "OPTIONS") {
    return handleOptions(request)
  }

  // Apply CORS middleware for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Apply CORS headers
    const corsResponse = corsMiddleware(request)

    // For protected API routes, validate API key
    if (
      request.nextUrl.pathname.startsWith("/api/v1/") &&
      !request.nextUrl.pathname.includes("/docs") &&
      !request.nextUrl.pathname.includes("/public")
    ) {
      const { valid, response } = await validateApiKey(request)
      if (!valid) {
        // Copy CORS headers to the error response
        Object.entries(corsResponse.headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        return response
      }
    }

    return corsResponse
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
