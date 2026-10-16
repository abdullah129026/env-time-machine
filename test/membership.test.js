import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { requireMembership, MembershipError } from '../lib/membership.js'

// minimal stub of the supabase query builder: from().select().eq().eq().maybeSingle()
function stubClient({ row = null, error = null } = {}) {
  const builder = {
    select() { return builder },
    eq() { return builder },
    async maybeSingle() { return { data: row, error } },
  }
  return { from() { return builder } }
}

describe('requireMembership', () => {
  it('throws a 403 MembershipError for a non-member', async () => {
    const client = stubClient({ row: null })
    await assert.rejects(
      () => requireMembership(client, 'project-1', 'user-b'),
      (err) => {
        assert.ok(err instanceof MembershipError)
        assert.equal(err.status, 403)
        return true
      }
    )
  })

  it('throws a 403 MembershipError when ids are missing', async () => {
    const client = stubClient()
    await assert.rejects(() => requireMembership(client, null, 'user-a'), MembershipError)
  })

  it('returns the membership row for an owner', async () => {
    const row = { project_id: 'project-1', user_id: 'user-a', role: 'owner' }
    const got = await requireMembership(stubClient({ row }), 'project-1', 'user-a')
    assert.deepEqual(got, row)
  })

  it('returns the membership row for a plain member', async () => {
    const row = { project_id: 'project-1', user_id: 'user-c', role: 'member' }
    const got = await requireMembership(stubClient({ row }), 'project-1', 'user-c')
    assert.deepEqual(got, row)
  })

  it('propagates database errors instead of masking them as 403', async () => {
    const dbError = new Error('connection reset')
    const client = stubClient({ error: dbError })
    await assert.rejects(() => requireMembership(client, 'project-1', 'user-a'), (err) => {
      assert.equal(err, dbError)
      return true
    })
  })
})
