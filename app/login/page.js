'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { browserClient, isConfigured } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    searchParams.get('error') ? 'That magic link did not work. Request a new one below.' : ''
  )

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const supabase = browserClient()
    if (!supabase) {
      setError('Sign-in is not configured yet.')
      setBusy(false)
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (!isConfigured()) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Sign in</h1>
          <div className="notice">Supabase is not configured yet. Add the env vars and redeploy.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>Sign in</h1>
        {sent ? (
          <p>Check your inbox for the magic link. It expires in one hour.</p>
        ) : (
          <>
            <p>Enter your email and we will send you a sign-in link. No password needed.</p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
