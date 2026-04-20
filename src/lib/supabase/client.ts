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
          const next = prev.then(() => fn()) as Promise<R>
          lockQueue[name] = next.catch(() => {})
          return next
        },
      },
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) => {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 30_000)
          return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timer))
        },
      },
    }
  )
  return client
}
