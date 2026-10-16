// .env parser. Pure function, no I/O. Rules per PLAN 3.4:
// strip `export ` prefixes, honor single/double quotes with escapes,
// multiline quoted values, skip comments and blank lines, last-wins on
// duplicate keys, skip-and-count lines without `=`, CRLF and UTF-8 BOM
// handled, null bytes rejected.

const ESCAPES = {
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  f: '\f',
  '\\': '\\',
  '"': '"',
  "'": "'",
}

// parseDotenv(text) -> { entries: [{key, value}], errors: [{line, message}], skipped }
// entries keep first-seen order; duplicates collapse last-wins.
// errors carry 1-based line numbers so the import preview can show them.
// skipped counts non-blank, non-comment lines that contain no `=`.
export function parseDotenv(text) {
  const errors = []
  let skipped = 0
  const found = new Map()

  if (text === null || text === undefined) return { entries: [], errors, skipped }
  const src = typeof text === 'string' ? text : String(text)

  // a null byte means the input is binary, not a .env file: refuse it outright
  if (src.includes('\0')) {
    errors.push({ line: 1, message: 'null byte found, refusing to parse' })
    return { entries: [], errors, skipped }
  }

  const body = src.charCodeAt(0) === 0xfeff ? src.slice(1) : src
  const lines = body.split(/\r\n|\r|\n/)

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    let rest = lines[i].trim()
    if (rest === '' || rest.startsWith('#')) continue

    rest = rest.replace(/^export\s+/, '')
    const eq = rest.indexOf('=')
    if (eq === -1) {
      skipped += 1
      continue
    }

    const key = rest.slice(0, eq).trim()
    if (key === '') {
      errors.push({ line: lineNo, message: 'missing key name before =' })
      continue
    }

    const raw = rest.slice(eq + 1)
    const first = raw.trimStart()[0]

    if (first === '"' || first === "'") {
      // quoted value: honor escapes in double quotes, literal in single
      // quotes, and consume following lines until the closing quote
      const quote = first
      let out = ''
      let j = raw.indexOf(quote) + 1
      let ln = i
      let closed = false
      while (ln < lines.length) {
        const L = ln === i ? raw : lines[ln]
        while (j < L.length) {
          const ch = L[j]
          if (quote === '"' && ch === '\\' && j + 1 < L.length) {
            const e = L[j + 1]
            out += e in ESCAPES ? ESCAPES[e] : '\\' + e
            j += 2
            continue
          }
          if (ch === quote) {
            closed = true
            break
          }
          out += ch
          j++
        }
        if (closed) break
        ln++
        if (ln < lines.length) out += '\n'
        j = 0
      }
      if (!closed) {
        errors.push({ line: lineNo, message: 'unterminated quoted value' })
        i = ln
        continue
      }
      // after the closing quote only whitespace or a comment may follow
      const tail = (ln === i ? raw : lines[ln]).slice(j + 1).trim()
      if (tail !== '' && !tail.startsWith('#')) {
        errors.push({ line: lineNo, message: 'unexpected text after quoted value' })
        i = ln
        continue
      }
      i = ln
      found.set(key, { key, value: out })
    } else {
      // unquoted: everything to end of line, trailing whitespace trimmed
      found.set(key, { key, value: raw.trim() })
    }
  }

  return { entries: [...found.values()], errors, skipped }
}
