import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listAuditEvents, AUDIT_ACTIONS } from '../lib/audit.js'
import { InputError } from '../lib/env.js'

// Chainable PostgREST stub that records every call it saw.
function stubSvc({ auditRows = [], envRow = { id: 'env-1' } } = {}) {
  const calls = []
  const chain = {
    select: (...a) => (calls.push(['select', ...a]), chain),
    eq: (c, v) => (calls.push(['eq', c, v]), chain),
    ilike: (c, v) => (calls.push(['ilike', c, v]), chain),
    gte: (c, v) => (calls.push(['gte', c, v]), chain),
    lte: (c, v) => (calls.push(['lte', c, v]), chain),
    order: (c, o) => (calls.push(['order', c, o]), chain),
    limit: (n) => (calls.push(['limit', n]), chain),
    async maybeSingle() {
      calls.push(['maybeSingle'])
      return { data: envRow, error: null }
    },
    then(resolve) {
      return Promise.resolve({ data: auditRows, error: null }).then(resolve)
    },
  }
  return {
    calls,
    from(table) {
      calls.push(['from', table])
      return chain
    },
  }
}

const row = {
  id: 'ev-1',
  created_at: '2026-10-17T09:00:00Z',
  actor_email: 'a@x.com',
  action: 'change',
  environment_id: 'env-1',
  target_key: null,
  details: { version_id: 'v-1', seq: 3, change_count: 2, message: 'Add KEY' },
  environments: { name: 'dev' },
}

describe('listAuditEvents', () => {
  it('maps rows to the safe event shape, env name included', async () => {
    const svc = stubSvc({ auditRows: [row] })
    const events = await listAuditEvents(svc, 'proj-1', {})
    assert.equal(events.length, 1)
    assert.deepEqual(events[0], {
      id: 'ev-1',
      created_at: '2026-10-17T09:00:00Z',
      actor_email: 'a@x.com',
      action: 'change',
      env: 'dev',
      target_key: null,
      version_id: 'v-1',
      seq: 3,
      change_count: 2,
      message: 'Add KEY',
    })
    const eqCalls = svc.calls.filter((c) => c[0] === 'eq')
    assert.ok(eqCalls.some((c) => c[1] === 'project_id' && c[2] === 'proj-1'), 'project filter missing')
  })

  it('applies actor, action, and date filters', async () => {
    const svc = stubSvc()
    await listAuditEvents(svc, 'proj-1', {
      actor: 'a@x',
      action: 'reveal',
      since: '2026-10-01',
      until: '2026-10-31',
    })
    assert.ok(svc.calls.some((c) => c[0] === 'ilike' && c[1] === 'actor_email' && c[2] === '%a@x%'))
    assert.ok(svc.calls.some((c) => c[0] === 'eq' && c[1] === 'action' && c[2] === 'reveal'))
    assert.ok(svc.calls.some((c) => c[0] === 'gte' && c[1] === 'created_at'))
    assert.ok(svc.calls.some((c) => c[0] === 'lte' && c[1] === 'created_at'))
  })

  it('resolves the env name to an id before filtering', async () => {
    const svc = stubSvc()
    await listAuditEvents(svc, 'proj-1', { env: 'prod' })
    assert.ok(svc.calls.some((c) => c[0] === 'from' && c[1] === 'environments'))
    assert.ok(
      svc.calls.some((c) => c[0] === 'eq' && c[1] === 'environment_id' && c[2] === 'env-1'),
      'environment_id filter missing'
    )
  })

  it('orders newest first and caps the page', async () => {
    const svc = stubSvc()
    await listAuditEvents(svc, 'proj-1', {})
    assert.ok(svc.calls.some((c) => c[0] === 'order' && c[1] === 'created_at' && c[2].ascending === false))
    assert.ok(svc.calls.some((c) => c[0] === 'limit'))
  })

  it('rejects unknown actions, environments, and bad dates', async () => {
    const svc = stubSvc()
    await assert.rejects(() => listAuditEvents(svc, 'proj-1', { action: 'hack' }), InputError)
    await assert.rejects(() => listAuditEvents(svc, 'proj-1', { env: 'qa' }), InputError)
    await assert.rejects(() => listAuditEvents(svc, 'proj-1', { since: 'not-a-date' }), InputError)
  })

  it('exposes the full audit action list for the filter UI', () => {
    assert.deepEqual([...AUDIT_ACTIONS].sort(), ['change', 'copy', 'create', 'delete', 'import', 'reveal', 'rollback', 'update'])
  })
})
