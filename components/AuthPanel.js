'use client'

import { useEffect, useState } from 'react'

const PROOFS = ['Every change diffed.', 'One-click rollback.', 'Audit log included.']

// Brand panel for the auth split screen: faint grid, a small diff visual,
// and one rotating proof line crossfading every 5s.
export default function AuthPanel() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIdx((i) => (i + 1) % PROOFS.length), 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="auth-panel" aria-hidden="true">
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--surface)',
          padding: 20,
          width: 'min(420px, 80%)',
          transform: 'scale(0.9)',
          transformOrigin: 'center',
        }}
      >
        <div className="diff-row">
          <span className="badge badge-updated">updated</span>
          <span className="mono" style={{ fontSize: 13 }}>STRIPE_KEY</span>
        </div>
        <div className="diff-row">
          <span className="diff-old mono" style={{ fontSize: 13 }}>••••••••</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→</span>
          <span className="diff-new mono" style={{ fontSize: 13 }}>••••••••</span>
        </div>
        <div className="diff-row" style={{ marginTop: 8 }}>
          <span className="badge badge-added">added</span>
          <span className="mono" style={{ fontSize: 13 }}>LOG_LEVEL</span>
        </div>
      </div>
      <div className="auth-proof" key={idx}>{PROOFS[idx]}</div>
    </div>
  )
}
