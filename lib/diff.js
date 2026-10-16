// Pure diff between two version snapshots. Inputs are plaintext states
// [{key, value}]; the outputs carry only the fixed mask, never the values,
// so the result is safe to serialize straight into a history response.
import { MASK } from './env.js'

// diffBetween(prevState, nextState) -> [{key, kind, oldValueMasked, newValueMasked}].
// Added rows get oldValueMasked null, deleted rows get newValueMasked null.
// When a version both adds and deletes, the entries carry possiblyRenamed
// so the UI can render them adjacent with a "possibly renamed" hint.
export function diffBetween(prev, next) {
  const p = new Map(prev.map((e) => [e.key, e.value]))
  const n = new Map(next.map((e) => [e.key, e.value]))

  const out = []
  for (const [key, value] of n) {
    if (!p.has(key)) {
      out.push({ key, kind: 'added', oldValueMasked: null, newValueMasked: MASK })
    } else if (p.get(key) !== value) {
      out.push({ key, kind: 'updated', oldValueMasked: MASK, newValueMasked: MASK })
    }
  }
  for (const key of p.keys()) {
    if (!n.has(key)) {
      out.push({ key, kind: 'deleted', oldValueMasked: MASK, newValueMasked: null })
    }
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  const hasAdd = out.some((d) => d.kind === 'added')
  const hasDel = out.some((d) => d.kind === 'deleted')
  if (hasAdd && hasDel) {
    for (const d of out) {
      if (d.kind !== 'updated') d.possiblyRenamed = true
    }
  }
  return out
}
