import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

// No admin client: all reads and downloads use the visitor's database policies.
export async function contentClient(url: string | undefined, key: string | undefined, authorization: string | null, authenticated?: (userId: string) => void) {
  if (!url || !key) throw new Error('تعذر الاتصال بالمنصة')
  if (authorization && !/^Bearer [^\s]+$/.test(authorization)) throw new Error('جلسة غير صالحة')
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
        headers.set('apikey', key)
        return fetch(input, { ...init, headers })
      },
    },
  })
  if (authorization) {
    const { data, error } = await client.auth.getUser(authorization.slice(7))
    if (error || !data.user) throw new Error('جلسة غير صالحة')
    authenticated?.(data.user.id)
  }
  return client
}
