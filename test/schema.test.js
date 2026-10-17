import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
let sql

before(async () => {
  sql = await readFile(path.join(dir, '..', 'supabase', 'migrations', '0001_schema.sql'), 'utf8')
})

const tables = () => [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1])

describe('0001_schema.sql', () => {
  it('creates exactly the six planned tables', () => {
    assert.deepEqual(tables().sort(), [
      'audit_events',
      'environments',
      'project_members',
      'projects',
      'variable_states',
      'versions',
    ])
  })

  it('grants select/insert/update/delete to service_role on every table', () => {
    const granted = [...sql.matchAll(/grant select, insert, update, delete on public\.(\w+) to service_role;/g)].map((m) => m[1])
    for (const t of tables()) {
      assert.ok(granted.includes(t), `missing service_role grant on ${t}`)
    }
  })

  it('never grants anything to anon or authenticated', () => {
    const code = sql.replace(/^--.*$/gm, '')
    assert.ok(!/grant\b[^;]*\bto anon\b/.test(code), 'grant to anon found')
    assert.ok(!/grant\b[^;]*\bto authenticated\b/.test(code), 'grant to authenticated found')
  })

  it('enables RLS on every table with no policies (default deny)', () => {
    for (const t of tables()) {
      assert.ok(sql.includes(`alter table public.${t} enable row level security;`), `RLS not enabled on ${t}`)
    }
    assert.ok(!/create policy/i.test(sql), 'unexpected policy found')
  })

  it('versions carry a per-environment unique sequence', () => {
    assert.ok(/unique\s*\(\s*environment_id\s*,\s*seq\s*\)/.test(sql), 'unique(environment_id, seq) missing')
  })

  it('environment names are limited to dev/staging/prod', () => {
    assert.ok(/check\s*\(\s*name in \('dev',\s*'staging',\s*'prod'\)\)/.test(sql), 'env name check missing')
  })

  // Regression test for the 2026-10-17 bug: commit_version writes
  // action = p_kind, so every value in the p_kind whitelist must also be
  // in the audit_events action check, or ordinary writes roll back.
  it('the audit action check accepts every action the code inserts', async () => {
    const check = sql.match(/check\s*\(\s*action in \(([^)]+)\)\)/)
    assert.ok(check, 'audit action check not found')
    const allowed = check[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))

    const rpc = await readFile(path.join(dir, '..', 'supabase', 'migrations', '0002_rpc.sql'), 'utf8')
    const kinds = rpc.match(/p_kind not in \(([^)]+)\)/)
    assert.ok(kinds, 'commit_version p_kind whitelist not found')
    for (const k of kinds[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))) {
      assert.ok(allowed.includes(k), `p_kind '${k}' is not an allowed audit action`)
    }

    // create_project inserts action 'create'; the reveal route logs
    // 'reveal' (default intent) and 'copy' (copy intent), chosen by the
    // server from the intent whitelist.
    assert.ok(allowed.includes('create'), "'create' is not an allowed audit action")
    const reveal = await readFile(
      path.join(dir, '..', 'app', 'api', 'projects', '[id]', 'env', '[env]', 'reveal', 'route.js'),
      'utf8'
    )
    assert.ok(/sp\.get\('intent'\) === 'copy' \? 'copy' : 'reveal'/.test(reveal), 'reveal route intent handling missing')
    assert.ok(/action:\s*readAction/.test(reveal), 'reveal route does not audit the intent')
  })
})
