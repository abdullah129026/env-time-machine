// Magic-link landing. Exchanges the code for a session cookie, then sends
// the user to `next` (same-origin paths only, see lib/auth.js).
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { loginRedirectTarget } from '@/lib/auth'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = loginRedirectTarget(searchParams.get('next'))
  const bad = (reason) => NextResponse.redirect(`${origin}/login?error=${reason}`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!code || !url || !key) return bad('auth')

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // ignore; the redirect still lands on the login page
        }
      },
    },
  })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return bad('auth')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const target = forwardedHost ? `https://${forwardedHost}${next}` : `${origin}${next}`
  return NextResponse.redirect(target)
}
