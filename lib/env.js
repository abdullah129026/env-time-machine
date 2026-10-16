// Env domain logic: current-state reads, server-side masking, key
// validation, and the change-set builders the API routes hand to the
// commit_version RPC. Everything here is pure or stub-testable; the DB
// contract itself is asserted against the migration SQL in the tests.
import { parseDotenv } from './dotenv.js'

export const ENVS = ['dev', 'staging', 'prod']

// server-side mask: fixed length for every value, reveals nothing about
// the real length. The only route that ever returns plaintext is reveal.
export const MASK = '●●●●●●'

// 400-class input errors. Routes map these to 400, anything else to 500.
export class InputError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InputError'
    this.status = 400
  }
}

export function keyNameError(key) {
  if (typeof key !== 'string' || key === '') return 'key is required'
  if (key.length > 128) return 'key is too long (max 128 characters)'
  if (!/^[A-Za-z_]/.test(key)) return 'key must start with a letter or underscore'
  if (!/^[A-Za-z0-9_]+$/.test(key)) return 'key may only contain letters, digits, and underscores'
  return null
}

// Current state is derived, not stored: the highest-seq version's
// variable_states, rows with deleted = false. One query via the versions
// relation plus the environments lookup for the head seq.
// ponytail: two round trips instead of a real join, because PostgREST has
// no subselect; the index on (environment_id, seq desc) keeps both cheap.
export async function getCurrentState(svc, projectId, envName) {
  const { data: env, error: envErr } = await svc
    .from('environments')
    .select('id, version_seq')
    .eq('project_id', projectId)
    .eq('name', envName)
    .maybeSingle()
  if (envErr) throw envErr
  if (!env || env.version_seq === 0) return []

  const { data: head, error: verErr } = await svc
    .from('versions')
    .select('variable_states(key, value)')
    .eq('environment_id', env.id)
    .eq('seq', env.version_seq)
    .eq('variable_states.deleted', false)
    .maybeSingle()
  if (verErr) throw verErr

  const rows = head?.variable_states ?? []
  return rows
    .map((r) => ({ key: r.key, value: r.value ?? '' }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export function maskState(state) {
  return state.map(({ key }) => ({ key, value: MASK }))
}

// The single mutation path: version row + variable_states rows + audit
// row commit as one unit inside the RPC, or roll back together.
export async function writeVersion(svc, { projectId, env, actorId, actorEmail, message, kind, changes }) {
  const { data, error } = await svc.rpc('commit_version', {
    p_project_id: projectId,
    p_env_name: env,
    p_actor_id: actorId,
    p_actor_email: actorEmail ?? '',
    p_message: message,
    p_kind: kind,
    p_changes: changes,
  })
  if (error) throw error
  return data
}

// Bulk replace: the full new state minus the current state, as RPC
// change entries. Keys in the input are set (or tombstoned when deleted),
// keys in current state but absent from the input are tombstoned too.
// Tombstones carry value null and deleted true; the RPC copies deleted
// rows into every later snapshot, so deleted keys stay resurrectable.
export function replaceChanges(current, nextEntries) {
  const next = new Map()
  for (const e of nextEntries) next.set(e.key, e) // last wins

  const changes = []
  for (const { key, value, deleted } of next.values()) {
    changes.push({ key, value: deleted ? null : value, deleted: !!deleted })
  }
  const nextKeys = new Set(next.keys())
  for (const { key } of current) {
    if (!nextKeys.has(key)) changes.push({ key, value: null, deleted: true })
  }
  return changes
}

// Import preview diff: added / updated / deleted vs current state.
// Values shown are from the user's own paste, never from the database.
export function diffImport(current, parsedEntries) {
  const cur = new Map(current.map((e) => [e.key, e.value]))
  const next = new Map(parsedEntries.map((e) => [e.key, e.value]))
  const added = []
  const updated = []
  const deleted = []
  for (const [key, value] of next) {
    if (!cur.has(key)) added.push({ key, value })
    else if (cur.get(key) !== value) updated.push({ key, value })
  }
  for (const key of cur.keys()) {
    if (!next.has(key)) deleted.push({ key })
  }
  return { added, updated, deleted }
}

// Import apply: replace semantics. The paste is the source of truth, so
// keys absent from the paste are tombstoned; only pasted keys named in
// `apply` (or all of them with 'all') are written. Keys in the paste but
// not in `apply` stay untouched: nothing is silently overwritten.
export function importChanges(current, parsedEntries, apply) {
  const next = new Map(parsedEntries.map((e) => [e.key, e.value]))
  const overlayKeys = apply === 'all' ? [...next.keys()] : apply
  for (const k of overlayKeys) {
    if (!next.has(k)) throw new InputError(`key not in paste: ${k}`)
  }
  const changes = overlayKeys.map((k) => ({ key: k, value: next.get(k), deleted: false }))
  for (const { key } of current) {
    if (!next.has(key)) changes.push({ key, value: null, deleted: true })
  }
  return { changes, appliedCount: overlayKeys.length }
}

function invalidKeys(entries) {
  return entries.map((e) => e.key).filter((k) => keyNameError(k))
}

// Preview: parse and diff, never write.
export async function previewImport(svc, projectId, envName, text) {
  const { entries, errors, skipped } = parseDotenv(text)
  const current = await getCurrentState(svc, projectId, envName)
  return { entries, errors, skipped, invalid: invalidKeys(entries), diff: diffImport(current, entries) }
}

// Apply: one version via the RPC, kind 'import'.
export async function applyImport(svc, { projectId, envName, actorId, actorEmail, text, apply }) {
  if (apply !== 'all' && !Array.isArray(apply)) {
    throw new InputError("apply must be 'all' or a list of keys")
  }
  if (Array.isArray(apply)) {
    for (const k of apply) {
      const err = keyNameError(k)
      if (err) throw new InputError(err)
    }
  }
  const { entries } = parseDotenv(text)
  const invalid = invalidKeys(entries)
  if (invalid.length) throw new InputError(`invalid key names: ${invalid.join(', ')}`)

  const current = await getCurrentState(svc, projectId, envName)
  const { changes, appliedCount } = importChanges(current, entries, apply)
  return writeVersion(svc, {
    projectId,
    env: envName,
    actorId,
    actorEmail,
    message: `Import .env (${appliedCount} keys)`,
    kind: 'import',
    changes,
  })
}
