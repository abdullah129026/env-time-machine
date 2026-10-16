import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseDotenv } from '../lib/dotenv.js'

describe('parseDotenv', () => {
  it('strips export prefixes', () => {
    const { entries, errors } = parseDotenv('export FOO=bar\nexport  BAZ=qux\n')
    assert.deepEqual(entries, [
      { key: 'FOO', value: 'bar' },
      { key: 'BAZ', value: 'qux' },
    ])
    assert.deepEqual(errors, [])
  })

  it('honors double quotes with escapes', () => {
    const { entries } = parseDotenv('A="line1\\nline2"\nB="say \\"hi\\""\nC="back\\\\slash"\n')
    assert.deepEqual(entries, [
      { key: 'A', value: 'line1\nline2' },
      { key: 'B', value: 'say "hi"' },
      { key: 'C', value: 'back\\slash' },
    ])
  })

  it('treats single quotes as literal (no escape processing)', () => {
    const { entries } = parseDotenv("A='no\\nescapes'\n")
    assert.deepEqual(entries, [{ key: 'A', value: 'no\\nescapes' }])
  })

  it('supports multiline quoted values', () => {
    const { entries, errors } = parseDotenv('KEY="-----BEGIN-----\nabc\ndef\n-----END-----"\nNEXT=1\n')
    assert.deepEqual(errors, [])
    assert.deepEqual(entries, [
      { key: 'KEY', value: '-----BEGIN-----\nabc\ndef\n-----END-----' },
      { key: 'NEXT', value: '1' },
    ])
  })

  it('skips comments and blank lines', () => {
    const { entries, errors, skipped } = parseDotenv('# header\n\nFOO=1\n   # indented\n\nBAR=2\n')
    assert.deepEqual(entries, [
      { key: 'FOO', value: '1' },
      { key: 'BAR', value: '2' },
    ])
    assert.equal(skipped, 0)
    assert.deepEqual(errors, [])
  })

  it('is last-wins on duplicate keys', () => {
    const { entries } = parseDotenv('FOO=first\nFOO=second\n')
    assert.deepEqual(entries, [{ key: 'FOO', value: 'second' }])
  })

  it('skips and counts lines without =', () => {
    const { entries, skipped } = parseDotenv('FOO=1\njust some words\nBAR=2\n\nexport BAZ\n')
    assert.deepEqual(entries, [
      { key: 'FOO', value: '1' },
      { key: 'BAR', value: '2' },
    ])
    assert.equal(skipped, 2)
  })

  it('handles CRLF and a UTF-8 BOM', () => {
    const { entries, errors } = parseDotenv('﻿FOO=1\r\nBAR=two\r\n')
    assert.deepEqual(errors, [])
    assert.deepEqual(entries, [
      { key: 'FOO', value: '1' },
      { key: 'BAR', value: 'two' },
    ])
  })

  it('rejects null bytes with an error and no entries', () => {
    const { entries, errors } = parseDotenv('FOO=ba\0r\nBAZ=1\n')
    assert.deepEqual(entries, [])
    assert.equal(errors.length, 1)
    assert.match(errors[0].message, /null byte/)
  })

  it('reports line numbers on parse errors', () => {
    const { errors } = parseDotenv('OK=1\nBAD="unterminated\nOK2=2\n')
    assert.equal(errors.length, 1)
    assert.equal(errors[0].line, 2)
  })

  it('keeps unquoted values verbatim apart from trailing space', () => {
    const { entries } = parseDotenv('URL=https://example.com/a?b=1&c=2   \nEMPTY=\n')
    assert.deepEqual(entries, [
      { key: 'URL', value: 'https://example.com/a?b=1&c=2' },
      { key: 'EMPTY', value: '' },
    ])
  })
})
