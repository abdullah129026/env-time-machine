import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { purgeOldData, RETENTION_DAYS } from '../lib/retention.js'

// PostgREST stub: environments.select() resolves the env rows,
// versions/audit_events.delete() chains eq/lt and resolves the deleted
// rows we declare.
function stubSvc({ envs = [], deletedVersions = [], deletedAudits = [] } = {}) {
  const calls = []
  const deleteChain = (table, deleted) => ({
    eq(c, v) {
      calls.push(['eq', table, c, v])
      return this
    },
    lt(c, v) {
      calls.push(['lt', table, c, v])
      return this
    },
    then(resolve) {
      return Promise.resolve({ data: deleted, error: null }).then(resolve)
    },
  })
  return {
    calls,
    from(table) {
      calls.push(['from', table])
      if (table === 'environments') {
        return {
          select() {
            calls.push(['select', table])
            return Promise.resolve({ data: envs, error: null })
          },
        }
      }
      return {
        delete: () => deleteChain(table, table === 'versions' ? deletedVersions : deletedAudits),
      }
    },
  }
}

const now = new Date('2026-10-17T09:00:00Z')
const cutoff = new Date(now.getTime() - 90 * 24 * 3600 * 1000).toISOString()

describe('purgeOldData', () => {
  it('deletes non-head versions older than 90 days, never the head', async () => {
    const svc = stubSvc({
      envs: [{ id: 'env-1', version_seq: 10 }],
      deletedVersions: [{ id: 'v-old' }],
    })
    const result = await purgeOldData(svc, { now })

    assert.equal(result.cutoff, cutoff)
    assert.equal(result.deleted_versions, 1)
    assert.equal(result.deleted_audit_events, 0)

    const ltCalls = svc.calls.filter((c) => c[0] === 'lt')
    assert.ok(
      ltCalls.some((c) => c[1] === 'versions' && c[2] === 'seq' && c[3] === 10),
      'head exclusion by seq missing'
    )
    assert.ok(
      ltCalls.some((c) => c[1] === 'versions' && c[2] === 'created_at' && c[3] === cutoff),
      'versions cutoff missing'
    )
    assert.ok(
      ltCalls.some((c) => c[1] === 'audit_events' && c[2] === 'created_at' && c[3] === cutoff),
      'audit cutoff missing'
    )
  })

  it('purges each environment separately so heads survive per env', async () => {
    const svc = stubSvc({ envs: [{ id: 'a', version_seq: 3 }, { id: 'b', version_seq: 7 }] })
    await purgeOldData(svc, { now })
    const seqLts = svc.calls.filter((c) => c[0] === 'lt' && c[1] === 'versions' && c[2] === 'seq')
    assert.deepEqual(seqLts.map((c) => c[3]).sort(), [3, 7])
  })

  it('returns zero counts when nothing is old enough', async () => {
    const svc = stubSvc()
    const result = await purgeOldData(svc, { now })
    assert.deepEqual(result, { cutoff, deleted_versions: 0, deleted_audit_events: 0 })
  })

  it('propagates a delete failure instead of reporting success', async () => {
    const failed = { data: null, error: new Error('db down') }
    const fail = () => Promise.resolve(failed)
    const svc = {
      from(table) {
        if (table === 'environments') return { select: () => Promise.resolve({ data: [], error: null }) }
        return {
          delete: () => ({
            eq: () => ({ lt: () => ({ lt: fail }) }),
            lt: fail,
          }),
        }
      },
    }
    await assert.rejects(() => purgeOldData(svc, { now }), /db down/)
  })

  it('retention is exactly 90 days', () => {
    assert.equal(RETENTION_DAYS, 90)
  })
})
