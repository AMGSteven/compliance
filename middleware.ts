import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsMiddleware, handleOptions } from "./lib/middleware/cors"
import { validateApiKey } from "./lib/middleware/api-key-middleware"
import { cookies } from 'next/headers'

export async function middleware(request: NextRequest) {
  // All API routes should be accessible without authentication
  // They'll use API key validation instead
  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Handle OPTIONS requests for CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request)
    }

    // Apply CORS middleware for API routes
    const corsResponse = corsMiddleware(request)

    // For protected API routes, validate API key
    if (
      request.nextUrl.pathname.startsWith("/api/v1/") &&
      !request.nextUrl.pathname.includes("/docs") &&
      !request.nextUrl.pathname.includes("/public")
    ) {
      const { valid, response } = await validateApiKey(request)
      if (!valid && response) {
        // Copy CORS headers to the error response
        Object.entries(corsResponse.headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        return response
      }
    }

    return corsResponse
  }

  // For non-API routes, check authentication
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/api/auth/login" ||
    request.nextUrl.pathname.includes("/_next/") ||
    request.nextUrl.pathname.includes("/favicon.ico")
  ) {
    return NextResponse.next()
  }

  // Check for authentication token
  const authToken = request.cookies.get("auth-token")?.value
  const isAuthenticated = authToken === "authenticated"

  // If not authenticated, redirect to login page
  if (!isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?from=${encodeURIComponent(request.nextUrl.pathname)}`
    return NextResponse.redirect(url)
  }

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
      if (!valid && response) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
