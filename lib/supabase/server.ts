import { createClient } from "@supabase/supabase-js"

export function createServerClient(requestHeaders?: Headers) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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
