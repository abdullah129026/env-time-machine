import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getHistory, getVersionState, InputError } from '../lib/env.js'
import { MASK } from '../lib/env.js'

// stub supabase client. from('environments') resolves the env row;
// from('versions') is a thenable builder: order/limit chain and await
// resolves the full list (already desc), maybeSingle applies eq filters.
function stubSvc({ env, versions = [], rpcCalls = [] } = {}) {
  return {
    async rpc(name, args) {
      rpcCalls.push({ name, args })
      return { data: 'version-uuid-1', error: null }
    },
    from(table) {
      if (table === 'environments') {
        const b = {
          select() { return b },
          eq() { return b },
          async maybeSingle() { return { data: env ?? null, error: null } },
        }
        return b
      }
      const filters = []
      const b = {
        select() { return b },
        eq(col, val) { filters.push([col, val]); return b },
        order() { return b },
        limit() { return b },
        then(resolve) { resolve({ data: versions, error: null }) },
        async maybeSingle() {
          let list = versions
          for (const [c, v] of filters) {
            if (c === 'id') list = list.filter((x) => x.id === v)
            else if (c === 'seq') list = list.filter((x) => x.seq === v)
            else if (c === 'environment_id') list = list.filter((x) => x.environment_id === v)
          }
          return { data: list[0] ?? null, error: null }
        },
      }
      return b
    },
  }
}

const SECRET_A = 'sk-live-alpha-hunter2'
const SECRET_B = 'sk-live-beta-rotated9'

function threeVersionSvc() {
  const env = { id: 'env-1', version_seq: 3 }
  const versions = [
    {
      id: 'v3', environment_id: 'env-1', seq: 3, message: 'Rotate API key',
      actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T10:00:00Z',
      variable_states: [
        { key: 'A', value: SECRET_A, deleted: false },
        { key: 'B', value: SECRET_B, deleted: false },
      ],
    },
    {
      id: 'v2', environment_id: 'env-1', seq: 2, message: 'Add B',
      actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T09:00:00Z',
      variable_states: [
        { key: 'A', value: SECRET_A, deleted: false },
        { key: 'B', value: 'sk-live-beta-old', deleted: false },
      ],
    },
    {
      id: 'v1', environment_id: 'env-1', seq: 1, message: 'Initial import',
      actor_email: 'a@x.com', kind: 'import', created_at: '2026-10-16T08:00:00Z',
      variable_states: [{ key: 'A', value: SECRET_A, deleted: false }],
    },
  ]
  return { svc: stubSvc({ env, versions }), env, versions }
}

describe('getHistory', () => {
  it('returns newest-first versions with a masked diff against each predecessor', async () => {
    const { svc } = threeVersionSvc()
    const h = await getHistory(svc, 'project-1', 'dev')
    assert.deepEqual(h.versions.map((v) => v.seq), [3, 2, 1])
    assert.deepEqual(h.versions[0].diff, [
      { key: 'B', kind: 'updated', oldValueMasked: MASK, newValueMasked: MASK },
    ])
    assert.deepEqual(h.versions[1].diff, [
      { key: 'B', kind: 'added', oldValueMasked: null, newValueMasked: MASK },
    ])
    // the first version diffs against the empty state
    assert.deepEqual(h.versions[2].diff, [
      { key: 'A', kind: 'added', oldValueMasked: null, newValueMasked: MASK },
    ])
    assert.equal(h.total, 3)
    assert.equal(h.hasMore, false)
  })

  it('filters by search across messages and keys', async () => {
    const { svc } = threeVersionSvc()
    const byMsg = await getHistory(svc, 'project-1', 'dev', { search: 'rotate' })
    assert.deepEqual(byMsg.versions.map((v) => v.seq), [3])
    const byKey = await getHistory(svc, 'project-1', 'dev', { search: 'b' })
    assert.deepEqual(byKey.versions.map((v) => v.seq), [3, 2])
  })

  it('filters by key for the per-key timeline', async () => {
    const { svc } = threeVersionSvc()
    const h = await getHistory(svc, 'project-1', 'dev', { key: 'B' })
    assert.deepEqual(h.versions.map((v) => v.seq), [3, 2])
    const onlyA = await getHistory(svc, 'project-1', 'dev', { key: 'A' })
    assert.deepEqual(onlyA.versions.map((v) => v.seq), [1])
  })

  it('caps at 100 versions and flags hasMore', async () => {
    const env = { id: 'env-1', version_seq: 105 }
    const versions = []
    for (let i = 105; i >= 1; i--) {
      versions.push({
        id: `v${i}`, environment_id: 'env-1', seq: i, message: `v${i}`,
        actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T10:00:00Z',
        variable_states: [{ key: `K${i}`, value: 'x', deleted: false }],
      })
    }
    const svc = stubSvc({ env, versions })
    const h = await getHistory(svc, 'project-1', 'dev')
    assert.equal(h.versions.length, 100)
    assert.equal(h.hasMore, true)
    assert.equal(h.total, 105)
    // the oldest shown version still got its predecessor's diff
    const kinds = Object.fromEntries(h.versions[99].diff.map((d) => [d.key, d.kind]))
    assert.deepEqual(kinds, { K5: 'deleted', K6: 'added' })
  })

  it('returns an empty history for an environment with no versions', async () => {
    const svc = stubSvc({ env: { id: 'env-1', version_seq: 0 } })
    assert.deepEqual(await getHistory(svc, 'project-1', 'dev'), {
      versions: [],
      total: 0,
      hasMore: false,
    })
  })

  it('carries no plaintext anywhere in the serialized response', async () => {
    const { svc } = threeVersionSvc()
    const body = JSON.stringify(await getHistory(svc, 'project-1', 'dev'))
    for (const secret of [SECRET_A, SECRET_B, 'sk-live-beta-old']) {
      assert.ok(!body.includes(secret), `leaked: ${secret.slice(0, 12)}...`)
    }
  })

  it('throws 400 for an unknown environment', async () => {
    const svc = stubSvc({ env: null })
    await assert.rejects(() => getHistory(svc, 'project-1', 'dev'), InputError)
  })
})

describe('getVersionState', () => {
  it('returns the live state of one version, tombstones excluded', async () => {
    const { svc } = threeVersionSvc()
    const v = await getVersionState(svc, 'v2')
    assert.equal(v.seq, 2)
    assert.deepEqual(v.live, [
      { key: 'A', value: SECRET_A },
      { key: 'B', value: 'sk-live-beta-old' },
    ])
  })

  it('throws 400 for a missing version', async () => {
    const { svc } = threeVersionSvc()
    await assert.rejects(() => getVersionState(svc, 'nope'), InputError)
  })
})
