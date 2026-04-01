import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using service role key.
 * Only for use in server-side code (Route Handlers, Server Actions).
 * Never import this in client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
