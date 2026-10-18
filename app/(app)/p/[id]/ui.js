'use client'

// Small shared bits for the project views: dialog shell, the
// production confirm dialog, and the dev/staging undo toast.

export function Dialog({ title, onClose, children }) {
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

// Prod confirm: lists exactly which keys will change before the request
// is sent. changes = {added: [], updated: [], deleted: []} of key names.
export function ConfirmChanges({ title, changes, note, confirmLabel = 'Confirm', busy, error, onConfirm, onClose }) {
  const total = changes.added.length + changes.updated.length + changes.deleted.length
  const rows = [
    ...changes.added.map((k) => ({ key: k, kind: 'added' })),
    ...changes.updated.map((k) => ({ key: k, kind: 'updated' })),
    ...changes.deleted.map((k) => ({ key: k, kind: 'deleted' })),
  ]
  return (
    <Dialog title={title} onClose={onClose}>
      <p>
        {total} key{total === 1 ? '' : 's'} will change:
      </p>
      <div className="tbl-scroll">
      <table className="tbl">
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}:${r.key}`}>
              <td className="mono">{r.key}</td>
              <td>
                <span className={`badge badge-${r.kind}`}>{r.kind}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {note && <p className="hint">{note}</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="dialog-actions">
        <button className="btn" type="button" disabled={busy} onClick={onConfirm}>
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

// Dev/staging undo toast. Undo calls the rollback route to the pre-write
// version; prod never gets a toast, it gets the confirm dialog instead.
export function Toast({ label, onUndo, onDismiss }) {
  return (
    <div className="toast" role="status">
      <span>{label}</span>
      {onUndo && (
        <button className="btn btn-ghost btn-sm" type="button" onClick={onUndo}>
          Undo
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}
