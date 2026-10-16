'use client'

import { useEffect, useRef, useState } from 'react'
import { browserClient, isConfigured } from '@/lib/supabase'

// Shared magic-link form for /login and /signup. Same flow, different copy.
// States: idle, sending (spinner, 150ms min so it never flashes), sent
// (check + resend with 30s cooldown), error (inline under the field).
export default function AuthForm({ mode }) {
  const signup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [state, setState] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const sentAt = useRef(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const invalid = touched && email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function send(e) {
    e?.preventDefault()
    const addr = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setTouched(true)
      return
    }
    setState('sending')
    setError('')
    sentAt.current = Date.now()
    const supabase = browserClient()
    if (!supabase) {
      setError('Sign-in is not configured yet.')
      setState('idle')
      return
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    // never flash the spinner: minimum 150ms on screen
    const wait = Math.max(0, 150 - (Date.now() - sentAt.current))
    await new Promise((r) => setTimeout(r, wait))
    setState('idle')
    if (error) setError(error.message)
    else {
      setState('sent')
      setCooldown(30)
    }
  }

  if (!isConfigured()) {
    return <div className="notice">Supabase is not configured yet. Add the env vars and redeploy.</div>
  }

  if (state === 'sent') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '1px solid var(--green)', color: 'var(--green)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, marginBottom: 16,
          }}
        >
          ✓
        </div>
        <h1>Check your inbox</h1>
        <p className="lede">
          We sent a sign-in link to <span className="mono">{email.trim()}</span>. It expires in one hour.
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={cooldown > 0}
          onClick={send}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={send} noValidate>
      <div className="field">
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="you@company.com"
          aria-invalid={invalid}
        />
        {invalid && <p className="error-text" style={{ marginTop: 6 }}>Enter a valid email address.</p>}
      </div>
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" type="submit" disabled={state === 'sending'} style={{ width: '100%' }}>
        {state === 'sending' ? (
          <><span className="btn-spinner" />Sending…</>
        ) : signup ? (
          'Create account'
        ) : (
          'Send magic link'
        )}
      </button>
    </form>
  )
}
