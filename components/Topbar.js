'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { browserClient } from '@/lib/supabase'

// Fuzzy match: every query char appears in order in the target.
function fuzzy(q, target) {
  q = q.toLowerCase()
  target = target.toLowerCase()
  let i = 0
  for (const c of target) {
    if (c === q[i]) i++
    if (i === q.length) return true
  }
  return i === q.length
}

function CmdK({ open, onClose, projects }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const router = useRouter()
  const inputRef = useRef(null)

  const items = useMemo(() => {
    const actions = [
      { label: 'Add variable', hint: 'action', run: () => router.push('?tab=secrets') },
      { label: 'Go to History', hint: 'action', run: () => router.push('?tab=history') },
      { label: 'Import .env', hint: 'action', run: () => router.push('?tab=secrets') },
      { label: 'All projects', hint: 'page', run: () => router.push('/') },
      { label: 'Account settings', hint: 'page', run: () => router.push('/settings') },
    ]
    const projs = projects.map((p) => ({
      label: p.name,
      hint: 'project',
      run: () => router.push(`/p/${p.id}`),
    }))
    const all = [...projs, ...actions]
    const query = q.trim()
    return query ? all.filter((i) => fuzzy(query, i.label)) : all
  }, [q, projects, router])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open ])

  useEffect(() => setSel(0), [q])

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((s) => Math.min(s + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter' && items[sel]) {
        items[sel].run()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, sel, close])

  if (!open) return null
  return (
    <div className="cmdk-overlay" onClick={close}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects and actions..."
          aria-label="Search"
        />
        <div className="cmdk-list">
          {items.length === 0 && <div className="cmdk-empty">No matches.</div>}
          {items.map((i, idx) => (
            <button
              key={`${i.hint}:${i.label}`}
              type="button"
              className={`cmdk-item${idx === sel ? ' selected' : ''}`}
              onMouseEnter={() => setSel(idx)}
              onClick={() => {
                i.run()
                close()
              }}
            >
              {i.label}
              <span className="tag">{i.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Slim 48px topbar: breadcrumb (project / env), env switcher on project
// pages, Cmd+K button and avatar on the right.
export default function Topbar({ projects, email }) {
  const [palOpen, setPalOpen] = useState(false)
  const [projName, setProjName] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const projId = pathname?.startsWith('/p/') ? pathname.split('/')[2] : null
  const env = searchParams?.get('env') || 'dev'
  const tab = searchParams?.get('tab') || 'secrets'

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!projId) {
      setProjName('')
      return
    }
    const known = projects.find((p) => p.id === projId)
    if (known) {
      setProjName(known.name)
      return
    }
    fetch(`/api/projects/${projId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProjName(d?.name ?? ''))
      .catch(() => setProjName(''))
  }, [projId, projects])

  const envHref = (e) => `/p/${projId}?env=${e}&tab=${tab}`

  // The sidebar user menu is hidden under 768px, so the mobile nav gets
  // its own sign-out. Same sign-out as the sidebar: clear the session,
  // back to login.
  async function signOut() {
    await browserClient()?.auth.signOut().catch(() => {})
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <header className="topbar">
        {/* Mobile nav: the sidebar is hidden under 768px, so this row
            (desktop: display none) carries brand, links, and the project
            switcher instead. */}
        <nav className="mobile-nav" aria-label="Primary">
          <a className="mobile-brand" href="/">
            <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, background: 'var(--accent)' }} />
            env time machine
          </a>
          <a href="/">Projects</a>
          <a href="/pricing">Pricing</a>
          <a href="/security">Security</a>
          <div className="switch-wrap">
            <ProjectSwitcher projects={projects} currentId={projId} />
          </div>
          {email && (
            <button type="button" className="mobile-signout" onClick={signOut}>
              Sign out
            </button>
          )}
        </nav>
        <nav className="crumbs" aria-label="Breadcrumb">
          {projId ? (
            <>
              <a href="/" style={{ color: 'var(--text-dim)' }}>Projects</a>
              <span className="sep">/</span>
              <strong>{projName || '…'}</strong>
              <span className="sep">/</span>
              <span>{env}</span>
            </>
          ) : (
            <strong>Projects</strong>
          )}
        </nav>
        {projId && (
          <div style={{ display: 'flex', gap: 4 }}>
            {['dev', 'staging', 'prod'].map((e) => (
              <a
                key={e}
                href={envHref(e)}
                className={`env-tab${e === env ? ' active' : ''}${e === 'prod' ? ' prod' : ''}`}
                style={{ padding: '4px 10px', fontSize: 13 }}
              >
                {e}
              </a>
            ))}
          </div>
        )}
        <span className="spacer" />
        <button type="button" className="cmdk-btn" onClick={() => setPalOpen(true)}>
          <span aria-hidden="true">⌕</span> <span className="cmdk-label">Search </span><span className="kbd">⌘K</span>
        </button>
        {email && <span className="avatar" title={email}>{(email[0] ?? '?').toUpperCase()}</span>}
      </header>
      <CmdK open={palOpen} onClose={() => setPalOpen(false)} projects={projects} />
    </>
  )
}
