'use client'

import { useMemo, useState } from 'react'

function Dialog({ title, onClose, children }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

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
// preview says so. Nothing is written until Apply.
function ImportPanel({ projectId, env, onDone }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  async function apply(mode) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, apply: mode === 'all' ? 'all' : [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'import failed')
      onDone()
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
    </div>
  )
}

export default function SecretsView({ projectId, env, initialEntries }) {
  const [entries, setEntries] = useState(initialEntries)
  const [query, setQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [dialog, setDialog] = useState(null) // 'add' | 'edit:<key>' | 'import'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const res = await fetch(`/api/projects/${projectId}/env/${env}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries ?? [])
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = entries.filter((e) => e.key.toLowerCase().includes(q))
    list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) * (sortAsc ? 1 : -1))
    return list
  }, [entries, query, sortAsc])

  async function saveVar(key, value, isDelete = false) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${env}/vars`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isDelete ? { key, deleted: true } : { key, value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'save failed')
      setDialog(null)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const editingKey = dialog?.startsWith('edit:') ? dialog.slice(5) : null

  return (
    <>
      {error && <p className="error-text">{error}</p>}

      {entries.length === 0 ? (
        <div className="empty">
          <h2>No variables in {env} yet</h2>
          <p>Paste a .env file to seed this environment, or add your first variable.</p>
          <div className="card" style={{ textAlign: 'left', marginTop: 16 }}>
            <ImportPanel projectId={projectId} env={env} onDone={reload} />
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

          <table className="tbl">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.key}>
                  <td className="mono">{e.key}</td>
                  <td className="mono dim">{e.value}</td>
                  <td className="tbl-actions">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="hint">No keys match the filter.</p>}
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
            onDone={async () => {
              setDialog(null)
              await reload()
            }}
          />
        </Dialog>
      )}
    </>
  )
}
