import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use a simple non-blocking lock to avoid navigator.locks issues
        // caused by React Strict Mode double-mounting
        lock: async (name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
          return await fn()
        },
      },
    }
  )
  return client
}
