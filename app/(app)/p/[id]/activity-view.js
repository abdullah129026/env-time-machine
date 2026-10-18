'use client'

import { useCallback, useEffect, useState } from 'react'
import { AUDIT_ACTIONS } from '@/lib/audit'

const ENVS = ['', 'dev', 'staging', 'prod']

function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// One row's human-readable detail. Change events carry the version seq
// and link into the history tab at that version; read events name the
// key. Values never appear: they never made it into the audit rows.
function Detail({ projectId, e }) {
  if ((e.action === 'change' || e.action === 'import' || e.action === 'rollback') && e.seq != null) {
    return (
      <span>
        {e.message}{' '}
        <a
          className="mono dim"
          href={`/p/${projectId}?env=${e.env ?? 'dev'}&tab=history&seq=${e.seq}`}
          title="Show this version in history"
        >
          v{e.seq}
        </a>
      </span>
    )
  }
  if (e.action === 'reveal' || e.action === 'copy') {
    return (
      <span>
        {e.action === 'reveal' ? 'Revealed ' : 'Copied '}
        <span className="mono">{e.target_key}</span>
      </span>
    )
  }
  if (e.action === 'create') return <span>Project created, environments seeded</span>
  return <span>{e.message ?? '—'}</span>
}

export default function ActivityView({ projectId }) {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [env, setEnv] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const sp = new URLSearchParams()
      if (actor.trim()) sp.set('actor', actor.trim())
      if (action) sp.set('action', action)
      if (env) sp.set('env', env)
      if (since) sp.set('since', new Date(since).toISOString())
      if (until) sp.set('until', new Date(until).toISOString())
      const res = await fetch(`/api/projects/${projectId}/activity?${sp}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'could not load activity')
      setEvents(data.events ?? [])
    } catch (e) {
      setError(e.message)
    }
  }, [projectId, actor, action, env, since, until])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      {error && <p className="error-text">{error}</p>}

      <div className="toolbar">
        <input
          className="search"
          type="text"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Filter by actor..."
          aria-label="Filter by actor"
        />
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={env} onChange={(e) => setEnv(e.target.value)} aria-label="Filter by environment">
          <option value="">All environments</option>
          {ENVS.slice(1).map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={since}
          max={until || undefined}
          onChange={(e) => setSince(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          value={until}
          min={since || undefined}
          onChange={(e) => setUntil(e.target.value)}
          aria-label="To date"
        />
      </div>

      {events === null ? (
        <div className="tbl-scroll">
        <table className="tbl" aria-label="Loading activity">
          <tbody>
            {[0, 1, 2, 3, 4].map((i) => (
              <tr key={i}>
                <td colSpan={5}>
                  <div className="skel" style={{ height: 14 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : events.length === 0 ? (
        <p className="hint">No activity matches these filters.</p>
      ) : (
        <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Env</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="dim num" title={new Date(e.created_at).toLocaleString()}>
                  {relTime(e.created_at)}
                </td>
                <td className="mono">{e.actor_email}</td>
                <td>
                  <span className="badge badge-kind">{e.action}</span>
                </td>
                <td>{e.env ?? '—'}</td>
                <td>
                  <Detail projectId={projectId} e={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  )
}
