'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserClient } from '@/lib/supabase'

// Project switcher (top of sidebar) and user menu (bottom). Client bits
// only; the project list and user come from the server layout.
export function ProjectSwitcher({ projects, currentId }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const current = projects.find((p) => p.id === currentId)

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <button type="button" className="proj-switch" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.name : 'Projects'}
        </span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, padding: 8, marginTop: 4 }}>
          <a
            className="nav-link"
            href="/"
            onClick={() => setOpen(false)}
            style={!currentId ? { color: 'var(--accent)' } : undefined}
          >
            All projects
          </a>
          {projects.map((p) => (
            <a
              key={p.id}
              className="nav-link"
              href={`/p/${p.id}`}
              onClick={() => setOpen(false)}
              style={p.id === currentId ? { color: 'var(--accent)' } : undefined}
            >
              {p.name}
            </a>
          ))}
          <a className="nav-link" href="/" onClick={() => setOpen(false)}>
            + New project
          </a>
        </div>
      )}
    </div>
  )
}

export function UserMenu({ email }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const initials = (email?.[0] ?? '?').toUpperCase()

  async function signOut() {
    await browserClient()?.auth.signOut().catch(() => {})
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="side-user" style={{ position: 'relative' }}>
      <span className="avatar">{initials}</span>
      <span className="email" title={email}>{email}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        ⋯
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 30, padding: 8, marginBottom: 4 }}>
          <a className="nav-link" href="/settings" onClick={() => setOpen(false)}>Settings</a>
          <button type="button" className="nav-link" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }} onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
