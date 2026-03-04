import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unauthorized } from '@/lib/api/errors'

/**
 * Checks that the request comes from an authenticated user.
 * Returns the user object if authenticated, or a 401 NextResponse if not.
 *
 * Usage in an API route:
 *   const auth = await requireAuth()
 *   if (auth.response) return auth.response  // 401
 *   const user = auth.user                   // authenticated user
 */
export async function requireAuth(): Promise<
  { user: { id: string; email?: string }; response?: never } |
  { user?: never; response: NextResponse }
> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { response: unauthorized('Authentication required') }
    }

    return { user: { id: user.id, email: user.email ?? undefined } }
  } catch {
    return { response: unauthorized('Authentication check failed') }
  }
}
