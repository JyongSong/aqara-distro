import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

// Simple sequential lock — avoids navigator.locks (React Strict Mode) but still serializes token refreshes
const lockQueue: Record<string, Promise<unknown>> = {}

export function createClient() {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: async <R,>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
          const prev = lockQueue[name] ?? Promise.resolve()
          const timeoutMs = _acquireTimeout > 0 ? _acquireTimeout : 30_000
          const next = prev.then(() =>
            Promise.race([
              fn(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`[supabase-lock] timeout: ${name}`)), timeoutMs)
              ),
            ])
          ) as Promise<R>
          lockQueue[name] = next.catch(() => {})
          return next
        },
      },
    }
  )
  return client
}
