'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmChanges, Toast } from './ui'

// Masked diff panel for one version: Added/Updated/Deleted badges with
// red-old and green-new panels side by side. Values are the fixed mask,
// never plaintext. Added/deleted pairs in the same version render
// adjacent with the "possibly renamed" hint.
function DiffPanel({ diff }) {
  if (diff.length === 0) return <p className="hint">No changes in this version.</p>
  const renamed = diff.filter((d) => d.possiblyRenamed)
  const rest = diff.filter((d) => !d.possiblyRenamed)
  const row = (d) => (
    <div className="diff-row" key={d.key}>
      <span className={`badge badge-${d.kind}`}>{d.kind}</span>
      <span className="mono">{d.key}</span>
      {d.oldValueMasked && <span className="diff-old mono">{d.oldValueMasked}</span>}
      {d.kind === 'updated' && <span className="dim">&rarr;</span>}
      {d.newValueMasked && <span className="diff-new mono">{d.newValueMasked}</span>}
    </div>
  )
  return (
    <div>
      {renamed.length > 0 && (
        <p className="hint">
          Possibly renamed: these keys were added and deleted in the same version.
        </p>
      )}
      {renamed.map(row)}
      {rest.map(row)}
    </div>
  )
}

function changesOf(diff) {
  const changes = { added: [], updated: [], deleted: [] }
  for (const d of diff) changes[d.kind].push(d.key)
  return changes
}

export default function HistoryView({ projectId, env, initialKey, initialSeq, onMutated }) {
  const [versions, setVersions] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [keyFilter, setKeyFilter] = useState(initialKey ?? '')
  const [selectedId, setSelectedId] = useState(null)
  const seqLink = useRef(initialSeq ?? null) // deep link from the activity log, consumed once
  const [confirmRb, setConfirmRb] = useState(null) // {version, headSeq, diff}
  const [rbBusy, setRbBusy] = useState(false)
  const [rbError, setRbError] = useState('')
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const sp = new URLSearchParams()
      if (search.trim()) sp.set('search', search.trim())
      if (keyFilter) sp.set('key', keyFilter)
      const res = await fetch(`/api/projects/${projectId}/env/${env}/history?${sp}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'could not load history')
      const vs = data.versions ?? []
      setVersions(vs)
      setHasMore(!!data.hasMore)
      // deep link from the activity log: expand the linked version once
      if (seqLink.current != null) {
        const target = vs.find((v) => v.seq === seqLink.current)
        if (target) setSelectedId(target.id)
        seqLink.current = null
      }
    } catch (e) {
      setError(e.message)
    }
  }, [projectId, env, search, keyFilter])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(t)
  }, [toast])

  const headSeq = versions[0]?.seq

  function startRollback(v) {
    if (env === 'prod') {
      setRbError('')
      setConfirmRb({ version: v, headSeq, diff: v.diff })
      return
    }
    doRollback({ targetId: v.id, targetSeq: v.seq, headSeq, confirmed: false })
  }

  async function doRollback({ targetId, targetSeq, headSeq, confirmed, silent }) {
    setRbBusy(true)
    setRbError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/rollback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetVersionId: targetId, headSeq, confirmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        // the head moved under the dialog: keep it open with the fresh
        // diff and the new head seq, and ask for confirmation again
        setConfirmRb({ version: { id: targetId, seq: targetSeq }, headSeq: data.currentSeq, diff: data.diff })
        setRbError('Someone changed this environment since this dialog was rendered. Review the new diff and confirm again.')
        return
      }
      if (!res.ok) throw new Error(data.error || 'rollback failed')
      setConfirmRb(null)
      const prevHead = versions[0]
      await load()
      onMutated?.()
      if (!silent && env !== 'prod' && prevHead) {
        setToast({
          label: `Rolled back to version ${targetSeq}`,
          undo: { targetId: prevHead.id, targetSeq: prevHead.seq, headSeq: data.seq },
        })
      }
    } catch (e) {
      setRbError(e.message)
    } finally {
      setRbBusy(false)
    }
  }

  async function undoToast() {
    const u = toast?.undo
    setToast(null)
    if (!u) return
    await doRollback({ targetId: u.targetId, targetSeq: u.targetSeq, headSeq: u.headSeq, confirmed: false, silent: true })
  }

  return (
    <>
      {error && <p className="error-text">{error}</p>}

      <div className="toolbar">
        <input
          className="search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages and keys..."
          aria-label="Search history"
        />
        <span className="spacer" />
        {hasMore && <span className="hint">Showing the 100 newest versions.</span>}
      </div>

      {keyFilter && (
        <p className="hint">
          Showing versions that touched <span className="mono">{keyFilter}</span>.{' '}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setKeyFilter('')}>
            Clear
          </button>
        </p>
      )}

      {versions.length === 0 && !error ? (
        <div className="empty">
          <div className="empty-glyph" aria-hidden="true">⟲</div>
          <h2>No changes yet</h2>
          <p>Edits you make will appear here as versions you can diff and roll back.</p>
        </div>
      ) : (
        versions.map((v) => (
          <div key={v.id}>
            <div
              className={`hist-row${selectedId === v.id ? ' selected' : ''}`}
              onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedId(selectedId === v.id ? null : v.id)
              }}
            >
              <span className="mono dim">v{v.seq}</span>
              <span className="badge badge-kind">{v.kind}</span>
              <span className="hist-msg">{v.message}</span>
              <span className="hist-meta">
                <span>{v.actor_email}</span>
                <span>{new Date(v.created_at).toLocaleString()}</span>
              </span>
              <span className="spacer" />
              {v.seq === headSeq ? (
                <span className="badge badge-kind">head</span>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    startRollback(v)
                  }}
                >
                  Roll back to here
                </button>
              )}
            </div>
            {selectedId === v.id && (
              <div className="diff-panel">
                <DiffPanel diff={v.diff} />
              </div>
            )}
          </div>
        ))
      )}

      {confirmRb && (
        <ConfirmChanges
          title={`Roll back ${env} to version ${confirmRb.version.seq}?`}
          changes={changesOf(confirmRb.diff)}
          note={`This dialog was rendered from version #${confirmRb.headSeq}. The rollback writes one new version at the head; nothing is deleted.`}
          confirmLabel="Roll back"
          busy={rbBusy}
          error={rbError}
          onConfirm={() =>
            doRollback({
              targetId: confirmRb.version.id,
              targetSeq: confirmRb.version.seq,
              headSeq: confirmRb.headSeq,
              confirmed: true,
            })
          }
          onClose={() => {
            setConfirmRb(null)
            setRbError('')
          }}
        />
      )}

      {toast && (
        <Toast label={toast.label} onUndo={toast.undo ? undoToast : null} onDismiss={() => setToast(null)} />
      )}
    </>
  )
}
