import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffBetween } from '../lib/diff.js'
import { MASK } from '../lib/env.js'

describe('diffBetween', () => {
  it('reports added, updated, and deleted keys with masked values', () => {
    const diff = diffBetween(
      [
        { key: 'KEEP', value: 'same' },
        { key: 'OLD', value: 'old-secret' },
        { key: 'GONE', value: 'gone-secret' },
      ],
      [
        { key: 'KEEP', value: 'same' },
        { key: 'OLD', value: 'new-secret' },
        { key: 'NEW', value: 'new-secret' },
      ]
    )
    assert.deepEqual(diff, [
      { key: 'GONE', kind: 'deleted', oldValueMasked: MASK, newValueMasked: null, possiblyRenamed: true },
      { key: 'NEW', kind: 'added', oldValueMasked: null, newValueMasked: MASK, possiblyRenamed: true },
      { key: 'OLD', kind: 'updated', oldValueMasked: MASK, newValueMasked: MASK },
    ])
  })

  it('marks the rename hint only when a version both adds and deletes', () => {
    const addOnly = diffBetween([], [{ key: 'A', value: '1' }])
    assert.equal(addOnly[0].possiblyRenamed, undefined)
    const delOnly = diffBetween([{ key: 'A', value: '1' }], [])
    assert.equal(delOnly[0].possiblyRenamed, undefined)
    const both = diffBetween([{ key: 'A', value: '1' }], [{ key: 'B', value: '2' }])
    assert.ok(both.every((d) => d.possiblyRenamed === true))
  })

  it('treats a resurrected key as added and an empty diff as no-op', () => {
    const diff = diffBetween([], [{ key: 'BACK', value: 'x' }])
    assert.equal(diff[0].kind, 'added')
    assert.deepEqual(diffBetween([{ key: 'A', value: '1' }], [{ key: 'A', value: '1' }]), [])
  })

  it('leaks no plaintext: no original value substring survives', () => {
    const prev = [{ key: 'DB', value: 'postgres://user:hunter2@db.internal:5432/app' }]
    const next = [{ key: 'DB', value: 'postgres://user:rotated9@db.internal:5432/app' }]
    const body = JSON.stringify(diffBetween(prev, next))
    for (const v of ['hunter2', 'rotated9', 'postgres://user']) {
      assert.ok(!body.includes(v), `leaked: ${v}`)
    }
  })
})
