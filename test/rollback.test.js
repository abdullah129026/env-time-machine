import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rollbackChanges,
  rollbackVersion,
  requireProdConfirm,
  HeadMovedError,
  InputError,
  MASK,
} from '../lib/env.js'

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

// head v3 (A=1, B=2), target v1 (A=0, B tombstoned): rollback resurrects
// the deleted key and restores the old value.
function rollbackSvc(rpcCalls = []) {
  const env = { id: 'env-1', version_seq: 3 }
  const versions = [
    {
      id: 'v3', environment_id: 'env-1', seq: 3, message: 'head',
      actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T10:00:00Z',
      variable_states: [
        { key: 'A', value: 'one-new', deleted: false },
        { key: 'B', value: 'two-new', deleted: false },
      ],
    },
    {
      id: 'v1', environment_id: 'env-1', seq: 1, message: 'first',
      actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T08:00:00Z',
      variable_states: [
        { key: 'A', value: 'one-old', deleted: false },
        { key: 'B', value: null, deleted: true },
      ],
    },
  ]
  return stubSvc({ env, versions, rpcCalls })
}

const base = {
  projectId: 'project-1',
  env: 'dev',
  actorId: 'user-1',
  actorEmail: 'a@x.com',
  targetVersionId: 'v1',
  headSeq: 3,
}

describe('rollbackChanges', () => {
  it('sets target-live keys and tombstones keys missing from the target', () => {
    const changes = rollbackChanges(
      [
        { key: 'A', value: 'one-new' },
        { key: 'B', value: 'two-new' },
      ],
      [{ key: 'A', value: 'one-old' }]
    )
    assert.deepEqual(changes, [
      { key: 'A', value: 'one-old', deleted: false },
      { key: 'B', value: null, deleted: true },
    ])
  })
})

describe('rollbackVersion', () => {
  it("appends one new head with kind 'rollback' and the target snapshot", async () => {
    const rpcCalls = []
    const svc = rollbackSvc(rpcCalls)
    const res = await rollbackVersion(svc, base)
    assert.deepEqual(res, { versionId: 'version-uuid-1', seq: 4 })
    assert.equal(rpcCalls.length, 1)
    const args = rpcCalls[0].args
    assert.equal(rpcCalls[0].name, 'commit_version')
    assert.equal(args.p_kind, 'rollback')
    assert.equal(args.p_message, 'Rolled back to version 1')
    // deleted keys resurrect because the target snapshot carries the tombstone:
    // B is live in the current head but tombstoned in v1, so it is tombstoned here
    assert.deepEqual(args.p_changes, [
      { key: 'A', value: 'one-old', deleted: false },
      { key: 'B', value: null, deleted: true },
    ])
  })

  it('rejects with 409 and the fresh masked diff when the head moved', async () => {
    const svc = rollbackSvc()
    const err = await rollbackVersion(svc, { ...base, headSeq: 2 }).catch((e) => e)
    assert.ok(err instanceof HeadMovedError)
    assert.equal(err.status, 409)
    assert.equal(err.currentSeq, 3)
    // fresh diff of what the rollback would now do: current head -> target (v1)
    // A updated, B deleted
    assert.deepEqual(err.diff, [
      { key: 'A', kind: 'updated', oldValueMasked: MASK, newValueMasked: MASK },
      { key: 'B', kind: 'deleted', oldValueMasked: MASK, newValueMasked: null },
    ])
    const body = JSON.stringify(err.diff)
    for (const secret of ['one-new', 'two-new', 'one-old']) {
      assert.ok(!body.includes(secret), `leaked: ${secret}`)
    }
  })

  it('refuses to roll back to the head itself', async () => {
    const svc = rollbackSvc()
    await assert.rejects(
      () => rollbackVersion(svc, { ...base, targetVersionId: 'v3' }),
      /already the head/
    )
  })

  it('refuses a target from another environment', async () => {
    const rpcCalls = []
    const env = { id: 'env-1', version_seq: 3 }
    const versions = [
      {
        id: 'v3', environment_id: 'env-1', seq: 3, message: 'head',
        actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T10:00:00Z',
        variable_states: [{ key: 'A', value: '1', deleted: false }],
      },
      {
        id: 'vx', environment_id: 'env-other', seq: 1, message: 'other',
        actor_email: 'a@x.com', kind: 'change', created_at: '2026-10-16T08:00:00Z',
        variable_states: [{ key: 'A', value: '0', deleted: false }],
      },
    ]
    const svc2 = stubSvc({ env, versions, rpcCalls })
    await assert.rejects(
      () => rollbackVersion(svc2, { ...base, targetVersionId: 'vx' }),
      /not found in this environment/
    )
    assert.equal(rpcCalls.length, 0, 'no version must be written')
  })
})

describe('requireProdConfirm', () => {
  it('throws confirm_required for prod without the flag', () => {
    assert.throws(() => requireProdConfirm('prod', undefined), (e) => {
      assert.ok(e instanceof InputError)
      assert.equal(e.status, 400)
      assert.equal(e.message, 'confirm_required')
      return true
    })
  })

  it('passes for prod with confirmed and for dev/staging without it', () => {
    assert.doesNotThrow(() => requireProdConfirm('prod', true))
    assert.doesNotThrow(() => requireProdConfirm('dev', undefined))
    assert.doesNotThrow(() => requireProdConfirm('staging', false))
  })

  it('gates rollback on prod through the same check', async () => {
    const svc = rollbackSvc()
    await assert.rejects(
      () => rollbackVersion(svc, { ...base, env: 'prod' }),
      /confirm_required/
    )
    const res = await rollbackVersion(svc, { ...base, env: 'prod', confirmed: true })
    assert.equal(res.seq, 4)
  })
})
