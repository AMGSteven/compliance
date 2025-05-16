import { createClient } from "@supabase/supabase-js"

/**
 * Create a Supabase client for server-side operations with fallbacks for static site generation
 */
export function createServerClient(requestHeaders?: Headers) {
  // Check if required environment variables exist
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Log missing variables in development (this will help with debugging)
  if (process.env.NODE_ENV === 'development') {
    if (!supabaseUrl) console.warn('NEXT_PUBLIC_SUPABASE_URL is missing');
    if (!supabaseServiceKey && !supabaseAnonKey) console.warn('Both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing');
  }
  
  // During static site generation or if environment variables are missing,
  // return a mock client or a client with defaults to prevent build errors
  if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
    // For static site generation, just return a minimal mock client
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      console.log('Creating mock Supabase client for static site generation');
      // Return a minimal mock client that won't throw errors during static site generation
      return {
        from: () => ({ select: () => ({ data: null, error: null }) }),
        auth: { getSession: () => ({ data: { session: null }, error: null }) }
      } as any;
    }
  }
  
  // Use service key if available, otherwise fall back to anon key
  const apiKey = supabaseServiceKey || supabaseAnonKey || '';
  
  return createClient(supabaseUrl || 'https://fallback-url.supabase.co', apiKey, {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        'Authorization': requestHeaders?.get('Authorization') || '',
      }
    }
  })
}
