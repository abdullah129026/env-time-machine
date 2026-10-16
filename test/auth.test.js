import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loginRedirectTarget } from '../lib/auth.js'

const dir = path.dirname(fileURLToPath(import.meta.url))

describe('loginRedirectTarget', () => {
  it('passes through same-origin paths', () => {
    assert.equal(loginRedirectTarget('/'), '/')
    assert.equal(loginRedirectTarget('/p/abc-123?env=prod'), '/p/abc-123?env=prod')
  })

  it('falls back to / for absolute, protocol-relative, empty, and non-string input', () => {
    assert.equal(loginRedirectTarget('https://evil.example/x'), '/')
    assert.equal(loginRedirectTarget('//evil.example/x'), '/')
    assert.equal(loginRedirectTarget(''), '/')
    assert.equal(loginRedirectTarget(null), '/')
    assert.equal(loginRedirectTarget(undefined), '/')
    assert.equal(loginRedirectTarget('javascript:alert(1)'), '/')
  })
})

describe('.env.example', () => {
  let example
  before(async () => {
    example = await readFile(path.join(dir, '..', '.env.example'), 'utf8')
  })

  it('documents all three supabase variables', () => {
    for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      assert.ok(example.includes(name), `missing ${name}`)
    }
  })
})
