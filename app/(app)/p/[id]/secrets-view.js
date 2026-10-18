'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, ConfirmChanges, Toast } from './ui'

// 30 seconds: how long a copied secret stays in the clipboard before we
// scrub it. Named here so the scrub timer and the toast stay in sync.
const CLIPBOARD_TTL_MS = 30_000

// Add and edit share one dialog. Values are multiline (private keys, certs).
// Renames are stated plainly: a rename is delete plus add, and the key's
// history stays on the old key.
function VarDialog({ initialKey, onSave, onClose, busy }) {
  const editing = initialKey != null
  const [key, setKey] = useState(initialKey ?? '')
  const [value, setValue] = useState('')

  return (
    <Dialog title={editing ? `Edit ${initialKey}` : 'Add variable'} onClose={onClose}>
      <div className="field">
        <label htmlFor="var-key">Key</label>
        <input
          id="var-key"
          className="mono"
          type="text"
          value={key}
          disabled={editing}
          onChange={(e) => setKey(e.target.value)}
          placeholder="DATABASE_URL"
          maxLength={128}
        />
      </div>
      <div className="field">
        <label htmlFor="var-value">Value</label>
        <textarea
          id="var-value"
          className="mono"
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="multiline values supported"
        />
      </div>
      {editing && (
        <p className="hint">
          Renaming a key is delete plus add: the new key starts a fresh history and the old
          key&apos;s history stays on the old key.
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="btn"
          type="button"
          disabled={busy || !key.trim()}
          onClick={() => onSave(key.trim(), value)}
        >
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Dialog>
  )
}

// Import: paste a .env, preview the diff, then apply selected keys or all.
// Replace semantics: keys absent from the paste are marked deleted, and the
// preview says so. Nothing is written until Apply. Production applies go
// through the confirm dialog first.
function ImportPanel({ projectId, env, onApplied }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(null) // {mode} | null

  async function runPreview() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, preview: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'preview failed')
      setPreview(data)
      setSelected(new Set([...data.diff.added, ...data.diff.updated].map((e) => e.key)))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function apply(mode, confirmed = false) {
    if (env === 'prod' && !confirmed) {
      setConfirming({ mode })
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          apply: mode === 'all' ? 'all' : [...selected],
          confirmed: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')
      setConfirming(null)
      onApplied(`Imported ${mode === 'all' ? 'all keys' : `${selected.size} keys`}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const badge = (kind) => (
    <span className={`badge badge-${kind}`}>{kind === 'added' ? 'new' : kind}</span>
  )

  return (
    <div>
      <div className="field">
        <label htmlFor="import-paste">Paste a .env file</label>
        <textarea
          id="import-paste"
          className="mono"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPreview(null)
          }}
          placeholder={'DATABASE_URL=postgres://...\nSTRIPE_KEY=sk_test_...'}
        />
      </div>
      <div className="dialog-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
        <button className="btn btn-ghost" type="button" disabled={busy || !text.trim()} onClick={runPreview}>
          {busy ? 'Parsing...' : 'Preview'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {preview && (
        <div style={{ marginTop: 16 }}>
          {(preview.errors ?? []).length > 0 && (
            <div className="field">
              <label>Parse errors</label>
              {preview.errors.map((e, i) => (
                <p key={i} className="err-list mono">
                  line {e.line}: {e.message}
                </p>
              ))}
            </div>
          )}
          {(preview.invalid ?? []).length > 0 && (
            <p className="error-text">
              invalid key names, cannot import: {(preview.invalid ?? []).join(', ')}
            </p>
          )}
          <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Key</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {preview.diff.added.map((e) => (
                <tr key={e.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(e.key)}
                      onChange={() => toggle(e.key)}
                      aria-label={`apply ${e.key}`}
                    />
                  </td>
                  <td className="mono">{e.key}</td>
                  <td>{badge('added')}</td>
                </tr>
              ))}
              {preview.diff.updated.map((e) => (
                <tr key={e.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(e.key)}
                      onChange={() => toggle(e.key)}
                      aria-label={`apply ${e.key}`}
                    />
                  </td>
                  <td className="mono">{e.key}</td>
                  <td>{badge('updated')}</td>
                </tr>
              ))}
              {preview.diff.deleted.map((e) => (
                <tr key={e.key}>
                  <td></td>
                  <td className="mono">{e.key}</td>
                  <td>{badge('deleted')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="hint">
            Replace semantics: keys absent from the paste are marked deleted. Unchecked keys are
            left untouched. One version is written per import.
          </p>
          <div className="dialog-actions">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy || selected.size === 0}
              onClick={() => apply('selected')}
            >
              Apply selected ({selected.size})
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy || preview.diff.added.length + preview.diff.updated.length === 0}
              onClick={() => apply('all')}
            >
              Apply all
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmChanges
          title={`Apply import to production?`}
          changes={{
            added: preview.diff.added
              .filter((e) => confirming.mode === 'all' || selected.has(e.key))
              .map((e) => e.key),
            updated: preview.diff.updated
              .filter((e) => confirming.mode === 'all' || selected.has(e.key))
              .map((e) => e.key),
            deleted: preview.diff.deleted.map((e) => e.key),
          }}
          note="Replace semantics: keys absent from the paste are marked deleted. Production values pin at build time; a redeploy banner appears after this change."
          confirmLabel="Apply import"
          busy={busy}
          error={error}
          onConfirm={() => apply(confirming.mode, true)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

export default function SecretsView({ projectId, env, initialEntries, onMutated }) {
  const [entries, setEntries] = useState(initialEntries)
  const [query, setQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [dialog, setDialog] = useState(null) // 'add' | 'edit:<key>' | 'import'
  const [confirm, setConfirm] = useState(null) // prod confirm {title, changes, note, confirmLabel, onConfirm}
  const [toast, setToast] = useState(null) // dev/staging undo {label, undo}
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState({}) // key -> ISO timestamp of last change
  const [revealed, setRevealed] = useState({}) // key -> plaintext, fetched on click only
  const [notice, setNotice] = useState(null) // transient note: copy/scrub messages
  const scrubTimers = useRef({})

  // Last-change timestamps come from the version history; no extra API
  // surface needed. One fetch per mount is enough for a table view.
  useEffect(() => {
    let alive = true
    fetch(`/api/projects/${projectId}/env/${env}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return
        const map = {}
        for (const v of d.versions ?? []) {
          for (const c of v.diff ?? []) {
            if (!(c.key in map)) map[c.key] = v.created_at
          }
        }
        setUpdatedAt(map)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [projectId, env])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(t)
  }, [toast])

  // Plaintext is env-scoped: switching environments discards it, and
  // unmounting clears any pending clipboard-scrub timers.
  useEffect(() => {
    setRevealed({})
    return () => {
      for (const t of Object.values(scrubTimers.current)) clearTimeout(t)
    }
  }, [projectId, env])

  async function reload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  function relTime(iso) {
    if (!iso) return '—'
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = entries.filter((e) => e.key.toLowerCase().includes(q))
    list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) * (sortAsc ? 1 : -1))
    return list
  }, [entries, query, sortAsc])

  async function saveVar(key, value, isDelete = false, confirmed = false) {
    // prod writes go through the confirm dialog first; the server enforces
    // the same gate, so a skipped dialog can never write
    if (env === 'prod' && !confirmed) {
      const exists = entries.some((e) => e.key === key)
      const changes = isDelete
        ? { added: [], updated: [], deleted: [key] }
        : exists
          ? { added: [], updated: [key], deleted: [] }
          : { added: [key], updated: [], deleted: [] }
      setConfirm({
        title: isDelete ? `Delete ${key} in production?` : exists ? `Update ${key} in production?` : `Add ${key} to production?`,
        changes,
        note: 'Production values pin at build time. A redeploy banner appears after this change.',
        confirmLabel: isDelete ? 'Delete' : 'Save',
        onConfirm: () => {
          setConfirm(null)
          saveVar(key, value, isDelete, true)
        },
      })
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/vars`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          isDelete ? { key, deleted: true, confirmed: true } : { key, value, confirmed: true }
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'save failed')
      setDialog(null)
      await afterWrite(isDelete ? `Deleted ${key}` : existsLabel(key))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function existsLabel(key) {
    return entries.some((e) => e.key === key) ? `Updated ${key}` : `Added ${key}`
  }

  // the version just before this write, for the undo toast
  async function undoInfo() {
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/history`)
      if (!res.ok) return null
      const data = await res.json()
      const vs = data.versions ?? []
      if (vs.length < 2) return null
      return { targetVersionId: vs[1].id, headSeq: vs[0].seq }
    } catch {
      return null
    }
  }

  async function afterWrite(label) {
    await reload()
    onMutated?.()
    if (env === 'prod') return // no toast on prod
    const info = await undoInfo()
    setToast(info ? { label, undo: info } : { label })
  }

  async function undoToast() {
    const u = toast?.undo
    setToast(null)
    if (!u) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/rollback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetVersionId: u.targetVersionId, headSeq: u.headSeq, confirmed: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'undo failed')
      await reload()
      onMutated?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // plaintext lives in component state only, fetched on click (never
  // hover), and is discarded the moment the row is re-masked. Both the
  // fetch and the audit happen server-side: the intent query decides
  // whether the route logs 'reveal' or 'copy'.
  async function fetchPlaintext(key, intent) {
    const res = await fetch(
      `/api/projects/${projectId}/env/${env}/reveal?key=${encodeURIComponent(key)}&intent=${intent}`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'could not read value')
    return data.value
  }

  async function toggleReveal(key) {
    if (revealed[key] != null) {
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }
    setError('')
    try {
      const value = await fetchPlaintext(key, 'reveal')
      setRevealed((prev) => ({ ...prev, [key]: value }))
    } catch (e) {
      setError(e.message)
    }
  }

  // Copy, then scrub: the clipboard is cleared after 30 seconds and the
  // toast says so. The clear is best-effort (some browsers need focus),
  // so a failed clear still tells the user to paste responsibly.
  async function copyValue(key) {
    setError('')
    try {
      const value = await fetchPlaintext(key, 'copy')
      await navigator.clipboard.writeText(value)
    } catch (e) {
      setError(`copy failed: ${e.message}`)
      return
    }
    clearTimeout(scrubTimers.current[key])
    scrubTimers.current[key] = setTimeout(async () => {
      let cleared = true
      try {
        await navigator.clipboard.writeText('')
      } catch {
        cleared = false
      }
      setNotice({
        label: cleared
          ? `Clipboard cleared: the copied value of ${key} is gone.`
          : `Could not clear the clipboard automatically. Clear the copied value of ${key} yourself.`,
      })
    }, CLIPBOARD_TTL_MS)
    setNotice({ label: `Copied, clipboard clears in 30 seconds` })
  }

  const editingKey = dialog?.startsWith('edit:') ? dialog.slice(5) : null

  return (
    <>
      {error && <p className="error-text">{error}</p>}

      {entries.length === 0 ? (
        <div className="empty">
          <div className="empty-glyph" aria-hidden="true">+</div>
          <h2>No variables in {env} yet</h2>
          <p>Paste a .env file to seed this environment, or add your first variable.</p>
          <div className="card" style={{ textAlign: 'left', marginTop: 16 }}>
            <ImportPanel projectId={projectId} env={env} onApplied={afterWrite} />
          </div>
          <div className="empty-actions">
            <button className="btn btn-ghost" type="button" onClick={() => setDialog('add')}>
              Add a variable instead
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter keys..."
              aria-label="Filter keys"
            />
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSortAsc((s) => !s)}>
              {sortAsc ? 'A-Z' : 'Z-A'}
            </button>
            <span className="spacer" />
            <button className="btn btn-ghost" type="button" onClick={() => setDialog('import')}>
              Import .env
            </button>
            <button className="btn" type="button" onClick={() => setDialog('add')}>
              Add variable
            </button>
          </div>

          {loading ? (
            <div className="tbl-scroll">
            <table className="tbl" aria-label="Loading variables">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Updated</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td><div className="skel" style={{ height: 14, width: '60%' }} /></td>
                    <td><div className="skel" style={{ height: 14, width: '40%' }} /></td>
                    <td><div className="skel" style={{ height: 14, width: 60 }} /></td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
          <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.key}>
                  <td>
                    <a
                      className="mono key-link"
                      href={`/p/${projectId}?env=${env}&tab=history&key=${encodeURIComponent(e.key)}`}
                      title="Show change timeline"
                    >
                      {e.key}
                    </a>
                  </td>
                  <td className="mono">
                    {revealed[e.key] != null ? (
                      <span className="reveal-val">{revealed[e.key]}</span>
                    ) : (
                      <span className="bullets">••••••••</span>
                    )}
                  </td>
                  <td className="dim num" title={updatedAt[e.key] ? new Date(updatedAt[e.key]).toLocaleString() : ''}>
                    {relTime(updatedAt[e.key])}
                  </td>
                  <td className="tbl-actions">
                    <span className="row-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => toggleReveal(e.key)}
                        aria-pressed={revealed[e.key] != null}
                      >
                        {revealed[e.key] != null ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => copyValue(e.key)}
                      >
                        Copy
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setDialog(`edit:${e.key}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        type="button"
                        disabled={busy}
                        onClick={() => saveVar(e.key, '', true)}
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
          {!loading && visible.length === 0 && <p className="hint">No keys match the filter.</p>}
        </>
      )}

      {dialog === 'add' && (
        <VarDialog busy={busy} onClose={() => setDialog(null)} onSave={(k, v) => saveVar(k, v)} />
      )}
      {editingKey && (
        <VarDialog
          initialKey={editingKey}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={(k, v) => saveVar(k, v)}
        />
      )}
      {dialog === 'import' && (
        <Dialog title="Import .env" onClose={() => setDialog(null)}>
          <ImportPanel
            projectId={projectId}
            env={env}
            onApplied={async (label) => {
              setDialog(null)
              await afterWrite(label)
            }}
          />
        </Dialog>
      )}

      {confirm && (
        <ConfirmChanges
          title={confirm.title}
          changes={confirm.changes}
          note={confirm.note}
          confirmLabel={confirm.confirmLabel}
          busy={busy}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}

      {toast && (
        <Toast label={toast.label} onUndo={toast.undo ? undoToast : null} onDismiss={() => setToast(null)} />
      )}

      {notice && <Toast label={notice.label} onDismiss={() => setNotice(null)} />}
    </>
  )
}
