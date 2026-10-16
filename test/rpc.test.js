import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
let sql
let commitBody
let createBody

// slice one function body out of the migration: from its CREATE to the next one
function fnBody(name) {
  const start = sql.indexOf(`function public.${name}(`)
  assert.ok(start > -1, `${name} not found`)
  const next = sql.indexOf('create or replace function', start + 10)
  return sql.slice(start, next === -1 ? undefined : next)
}

const count = (body, re) => [...body.matchAll(new RegExp(re, 'g'))].length

before(async () => {
  sql = await readFile(path.join(dir, '..', 'supabase', 'migrations', '0002_rpc.sql'), 'utf8')
  commitBody = fnBody('commit_version')
  createBody = fnBody('create_project')
})

describe('commit_version', () => {
  it('is one function with exactly one seq bump, one versions insert, one audit insert', () => {
    assert.equal(count(commitBody, 'version_seq = version_seq \\+ 1'), 1, 'seq bump count')
    assert.equal(count(commitBody, 'insert into public\\.versions\\b'), 1, 'versions insert count')
    assert.equal(count(commitBody, 'insert into public\\.audit_events\\b'), 1, 'audit insert count')
  })

  it('rejects environment names outside dev/staging/prod', () => {
    assert.ok(/not in \('dev',\s*'staging',\s*'prod'\)/.test(commitBody), 'env whitelist missing')
  })

  it('never writes values into the audit details', () => {
    const details = commitBody.slice(commitBody.indexOf('jsonb_build_object'))
    assert.ok(!/value/.test(details), 'audit details mention values')
  })
})

describe('create_project', () => {
  it('inserts project, owner membership, and all three environments in one body', () => {
    assert.equal(count(createBody, 'insert into public\\.projects\\b'), 1)
    assert.equal(count(createBody, 'insert into public\\.project_members\\b'), 1)
    assert.equal(count(createBody, 'insert into public\\.environments\\b'), 1)
    for (const env of ['dev', 'staging', 'prod']) {
      assert.ok(createBody.includes(`'${env}'`), `missing ${env} seed`)
    }
  })
})

describe('rpc grants', () => {
  it('grants execute on both functions to service_role only', () => {
    assert.ok(/grant execute on function public\.commit_version\(uuid, text, uuid, text, text, text, jsonb\) to service_role;/.test(sql))
    assert.ok(/grant execute on function public\.create_project\(text, uuid, text\) to service_role;/.test(sql))
    assert.ok(!/to anon/.test(sql), 'execute grant to anon found')
    assert.ok(!/to authenticated/.test(sql), 'execute grant to authenticated found')
  })
})
