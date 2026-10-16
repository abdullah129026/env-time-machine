import { Suspense } from 'react'
import AuthForm from '@/components/AuthForm'
import AuthPanel from '@/components/AuthPanel'

export const metadata = { title: 'Sign in — Env Time Machine' }

function Brand() {
  return (
    <a className="auth-brand" href="/landing">
      <span className="mark" />
      env time machine
    </a>
  )
}

export default function LoginPage() {
  return (
    <div className="auth-split">
      <div className="auth-form-side">
        <div className="auth-form-inner">
          <Brand />
          <h1>Welcome back</h1>
          <p className="lede">Sign in with a magic link. No password to forget.</p>
          <Suspense>
            <AuthForm mode="login" />
          </Suspense>
          <div className="auth-divider">or</div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>
            New here? <a href="/signup">Create an account</a>
          </p>
        </div>
      </div>
      <AuthPanel />
    </div>
  )
}
