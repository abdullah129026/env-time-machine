import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getCurrentState,
  maskState,
  writeVersion,
  keyNameError,
  replaceChanges,
  diffImport,
  importChanges,
  previewImport,
  applyImport,
  MASK,
  InputError,
} from '../lib/env.js'

const dir = path.dirname(fileURLToPath(import.meta.url))

// stub of the supabase client: from(table).select().eq()*().maybeSingle(),
// plus rpc() recording every call.
function stubSvc({ tables = {}, rpcCalls = [] } = {}) {
  const touched = []
  return {
    touched,
    async rpc(name, args) {
      rpcCalls.push({ name, args })
      return { data: 'version-uuid-1', error: null }
    },
    from(table) {
      touched.push(table)
      const rows = tables[table]
      const builder = {
        select() { return builder },
        eq() { return builder },
        async maybeSingle() {
          if (rows instanceof Error) return { data: null, error: rows }
          return { data: rows, error: null }
        },
      }
      return builder
    },
  }
}

describe('getCurrentState', () => {
  it('returns the head version states sorted by key', async () => {
    const svc = stubSvc({
      tables: {
        environments: { id: 'env-1', version_seq: 3 },
        versions: {
          variable_states: [
            { key: 'ZEBRA', value: 'z' },
            { key: 'APPLE', value: 'a' },
          ],
        },
      },
    })
    const state = await getCurrentState(svc, 'project-1', 'dev')
    assert.deepEqual(state, [
      { key: 'APPLE', value: 'a' },
      { key: 'ZEBRA', value: 'z' },
    ])
  })

  it('returns [] for an environment with no versions yet', async () => {
    const svc = stubSvc({ tables: { environments: { id: 'env-1', version_seq: 0 } } })
    const state = await getCurrentState(svc, 'project-1', 'dev')
    assert.deepEqual(state, [])
    assert.ok(!svc.touched.includes('versions'), 'should not query versions when seq is 0')
  })

  it('throws instead of masking database errors', async () => {
    const svc = stubSvc({ tables: { environments: new Error('db down') } })
    await assert.rejects(() => getCurrentState(svc, 'project-1', 'dev'), /db down/)
  })
})

describe('maskState', () => {
  it('replaces every value with the fixed mask', () => {
    const state = [
      { key: 'A', value: 'short' },
      { key: 'B', value: 'a-much-longer-secret-value' },
    ]
    const masked = maskState(state)
    assert.deepEqual(masked, [
      { key: 'A', value: MASK },
      { key: 'B', value: MASK },
    ])
  })

  it('leaks no original value: the masked response contains no value longer than the mask', () => {
    const state = [
      { key: 'DATABASE_URL', value: 'postgres://user:hunter2@db.internal:5432/app' },
      { key: 'API_KEY', value: 'sk-live-9f8e7d6c5b4a' },
    ]
    const body = JSON.stringify({ entries: maskState(state) })
    for (const { value } of state) {
      assert.ok(!body.includes(value), `leaked: ${value.slice(0, 8)}...`)
    }
  })
})

describe('keyNameError', () => {
  it('accepts conventional env key names', () => {
    for (const k of ['FOO', 'DATABASE_URL', '_PRIVATE', 'A1', 'x'.repeat(128)]) {
      assert.equal(keyNameError(k), null, k)
    }
  })

  it('rejects bad key names with a message', () => {
    assert.match(keyNameError(''), /required/)
    assert.match(keyNameError('1ABC'), /start with a letter/)
    assert.match(keyNameError('has space'), /only contain/)
    assert.match(keyNameError('has-dash'), /only contain/)
    assert.match(keyNameError('x'.repeat(129)), /too long/)
    assert.match(keyNameError(42), /required/)
  })
})

describe('writeVersion', () => {
  it('calls the commit_version RPC with the mutation contract', async () => {
    const rpcCalls = []
    const svc = stubSvc({ rpcCalls })
    const id = await writeVersion(svc, {
      projectId: 'p1',
      env: 'dev',
      actorId: 'u1',
      actorEmail: 'a@b.c',
      message: 'Add FOO',
      kind: 'change',
      changes: [{ key: 'FOO', value: 'bar', deleted: false }],
    })
    assert.equal(id, 'version-uuid-1')
    assert.equal(rpcCalls.length, 1)
    const { name, args } = rpcCalls[0]
    assert.equal(name, 'commit_version')
    assert.equal(args.p_project_id, 'p1')
    assert.equal(args.p_env_name, 'dev')
    assert.equal(args.p_kind, 'change')
    assert.equal(args.p_message, 'Add FOO')
    assert.deepEqual(args.p_changes, [{ key: 'FOO', value: 'bar', deleted: false }])
  })
})

describe('replaceChanges', () => {
  it('sets input keys and tombstones current keys absent from the input', () => {
    const changes = replaceChanges(
      [
        { key: 'KEEP', value: 'old' },
        { key: 'GONE', value: 'x' },
      ],
      [{ key: 'KEEP', value: 'new', deleted: false }]
    )
    assert.deepEqual(changes, [
      { key: 'KEEP', value: 'new', deleted: false },
      { key: 'GONE', value: null, deleted: true },
    ])
  })

  it('carries deleted tombstones so keys stay resurrectable in snapshots', () => {
    const changes = replaceChanges(
      [{ key: 'A', value: '1' }],
      [{ key: 'A', value: null, deleted: true }]
    )
    assert.deepEqual(changes, [{ key: 'A', value: null, deleted: true }])
  })
})

describe('diffImport', () => {
  it('splits pasted keys into added, updated, and deleted', () => {
    const diff = diffImport(
      [
        { key: 'SAME', value: '1' },
        { key: 'CHANGED', value: 'old' },
        { key: 'REMOVED', value: 'x' },
      ],
      [
        { key: 'SAME', value: '1' },
        { key: 'CHANGED', value: 'new' },
        { key: 'FRESH', value: 'y' },
      ]
    )
    assert.deepEqual(diff.added, [{ key: 'FRESH', value: 'y' }])
    assert.deepEqual(diff.updated, [{ key: 'CHANGED', value: 'new' }])
    assert.deepEqual(diff.deleted, [{ key: 'REMOVED' }])
  })
})

describe('importChanges', () => {
  const current = [
    { key: 'KEEP', value: 'old' },
    { key: 'STALE', value: 'x' },
  ]
  const parsed = [
    { key: 'KEEP', value: 'new' },
    { key: 'FRESH', value: 'y' },
    { key: 'IGNORED', value: 'z' },
  ]

  it("with 'all' the paste is the full new state and absent keys are tombstoned", () => {
    const { changes, appliedCount } = importChanges(current, parsed, 'all')
    assert.equal(appliedCount, 3)
    assert.deepEqual(changes, [
      { key: 'KEEP', value: 'new', deleted: false },
      { key: 'FRESH', value: 'y', deleted: false },
      { key: 'IGNORED', value: 'z', deleted: false },
      { key: 'STALE', value: null, deleted: true },
    ])
  })

  it('with explicit keys, unselected pasted keys stay untouched', () => {
    const { changes, appliedCount } = importChanges(current, parsed, ['FRESH'])
    assert.equal(appliedCount, 1)
    const keys = changes.map((c) => c.key)
    assert.ok(keys.includes('FRESH'), 'selected key applied')
    assert.ok(keys.includes('STALE'), 'absent-from-paste key tombstoned')
    assert.ok(!keys.includes('IGNORED'), 'unselected pasted key untouched')
    assert.ok(!keys.includes('KEEP'), 'unselected pasted key untouched')
  })

  it('rejects apply keys that are not in the paste', () => {
    assert.throws(() => importChanges(current, parsed, ['NOPE']), InputError)
  })
})

describe('previewImport', () => {
  it('never writes: the RPC is not called on preview', async () => {
    const rpcCalls = []
    const svc = stubSvc({
      rpcCalls,
      tables: {
        environments: { id: 'env-1', version_seq: 1 },
        versions: { variable_states: [{ key: 'A', value: '1' }] },
      },
    })
    const preview = await previewImport(svc, 'p1', 'dev', 'A=2\nB=3\n')
    assert.equal(rpcCalls.length, 0)
    assert.deepEqual(preview.diff.added, [{ key: 'B', value: '3' }])
    assert.deepEqual(preview.diff.updated, [{ key: 'A', value: '2' }])
    assert.deepEqual(preview.diff.deleted, [])
    assert.deepEqual(preview.errors, [])
    assert.equal(preview.skipped, 0)
  })
})

describe('applyImport', () => {
  it('writes one version with kind import and the Import message', async () => {
    const rpcCalls = []
    const svc = stubSvc({
      rpcCalls,
      tables: {
        environments: { id: 'env-1', version_seq: 1 },
        versions: { variable_states: [{ key: 'A', value: '1' }] },
      },
    })
    await applyImport(svc, {
      projectId: 'p1',
      envName: 'dev',
      actorId: 'u1',
      actorEmail: 'a@b.c',
      text: 'A=2\nB=3\n',
      apply: 'all',
    })
    assert.equal(rpcCalls.length, 1)
    const { args } = rpcCalls[0]
    assert.equal(args.p_kind, 'import')
    assert.equal(args.p_message, 'Import .env (2 keys)')
    assert.deepEqual(args.p_changes, [
      { key: 'A', value: '2', deleted: false },
      { key: 'B', value: '3', deleted: false },
    ])
  })

  it('rejects invalid key names as input errors', async () => {
    const svc = stubSvc({ tables: { environments: { id: 'env-1', version_seq: 0 } } })
    await assert.rejects(
      () =>
        applyImport(svc, {
          projectId: 'p1',
          envName: 'dev',
          actorId: 'u1',
          actorEmail: 'a@b.c',
          text: 'BAD-NAME=1\n',
          apply: 'all',
        }),
      InputError
    )
  })
})

describe('commit_version snapshot contract', () => {
  it('copies deleted rows into every new snapshot so deletes stay resurrectable', async () => {
    const sql = await readFile(path.join(dir, '..', 'supabase', 'migrations', '0002_rpc.sql'), 'utf8')
    // the base snapshot copy carries s.deleted forward
    assert.ok(/select v_version_id, s\.key, s\.value, s\.deleted/.test(sql), 'snapshot copy drops deleted flag')
    // changes upsert on (version_id, key)
    assert.ok(/on conflict \(version_id, key\) do update/.test(sql), 'change upsert missing')
  })
})
