'use client'

import { useState } from 'react'

const TARGETS = ['vercel', 'render', 'supabase', 'none']

// Minimal settings panel: the deploy target drives the redeploy banner
// copy shown after production changes. Saving is owner-only on the server.
export default function SettingsView({ projectId, initialTarget }) {
  const [target, setTarget] = useState(initialTarget ?? 'none')
  const [saved, setSaved] = useState(initialTarget ?? 'none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function save() {
    setBusy(true)
    setError('')
    setOk('')
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deploy_target: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'save failed')
      setSaved(target)
      setOk('Saved.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0, fontSize: 17 }}>Settings</h2>
      <div className="field">
        <label htmlFor="deploy-target">Deploy target</label>
        <select id="deploy-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p className="hint">
          Where this project deploys. After a production change, the banner on the environment
          view names this platform and gives the exact redeploy steps.
        </p>
      </div>
      {error && <p className="error-text">{error}</p>}
      {ok && <p className="hint">{ok}</p>}
      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" type="button" disabled={busy || target === saved} onClick={save}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
