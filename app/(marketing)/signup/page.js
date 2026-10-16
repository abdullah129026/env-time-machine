import { Suspense } from 'react'
import AuthForm from '@/components/AuthForm'
import AuthPanel from '@/components/AuthPanel'

export const metadata = { title: 'Create account — Env Time Machine' }

function Brand() {
  return (
    <a className="auth-brand" href="/landing">
      <span className="mark" />
      env time machine
    </a>
  )
}

export default function SignupPage() {
  return (
    <div className="auth-split">
      <div className="auth-form-side">
        <div className="auth-form-inner">
          <Brand />
          <h1>Create your account</h1>
          <p className="lede">Free for one project. No card.</p>
          <Suspense>
            <AuthForm mode="signup" />
          </Suspense>
          <p className="auth-fine">
            By continuing you agree to the <a href="/security">Terms</a> and{' '}
            <a href="/security">Privacy Policy</a>.
          </p>
          <div className="auth-divider">or</div>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>
            Have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
      <AuthPanel />
    </div>
  )
}
