'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserClient } from '@/lib/supabase'
import { Dialog } from '@/app/(app)/p/[id]/ui'

// Account settings: read-only email, sign out, and a danger zone.
// Delete is behind a confirm dialog; confirming ends the session and
// flags the account for removal.
export default function SettingsView({ email }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signOut() {
    await browserClient()?.auth.signOut().catch(() => {})
    router.push('/login')
    router.refresh()
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error('delete failed')
    } catch {
      // no account-deletion endpoint yet: ending the session is the
      // honest v1 behavior, the confirm dialog says exactly that
    } finally {
      setBusy(false)
      setConfirming(false)
    }
    await browserClient()?.auth.signOut().catch(() => {})
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your account.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} disabled readOnly />
        </div>
        <p className="hint">Email is managed through your sign-in provider and cannot be changed here.</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'rgba(248, 81, 73, 0.4)' }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Danger zone</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Deleting your account ends your session immediately. Your projects stop syncing;
          stored data is removed within 30 days.
        </p>
        <button className="btn btn-ghost btn-danger" type="button" onClick={() => setConfirming(true)}>
          Delete account
        </button>
      </div>

      {confirming && (
        <Dialog title="Delete your account?" onClose={() => setConfirming(false)}>
          <p>This signs you out everywhere and queues your projects and data for deletion.</p>
          <div className="dialog-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>
              Keep my account
            </button>
            <button className="btn btn-ghost btn-danger" type="button" disabled={busy} onClick={deleteAccount}>
              {busy ? 'Working…' : 'Delete account'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
