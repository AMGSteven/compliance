import { createClient } from "@supabase/supabase-js"

/**
 * Create a Supabase client for server-side operations
 */
export function createServerClient(requestHeaders?: Headers) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('Supabase environment variables are missing:', { 
      url_exists: !!url, 
      key_exists: !!key 
    });
  }
  
  return createClient(url!, key!, {
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
