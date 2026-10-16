import { gate, json, routeError } from '@/lib/guard'
import { getCurrentState, maskState, writeVersion, replaceChanges, keyNameError, requireProdConfirm } from '@/lib/env'

export async function GET(_request, { params }) {
  const { id, env } = await params
  const g = await gate(id, env)
  if (g.error) return g.error
  try {
    const state = await getCurrentState(g.svc, id, env)
    // masked only: plaintext never leaves the server except via reveal
    return json({ env, entries: maskState(state) })
  } catch {
    return json({ error: 'could not load environment state' }, 500)
  }
}

export async function PUT(request, { params }) {
  const { id, env } = await params
  const g = await gate(id, env)
  if (g.error) return g.error

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const list = Array.isArray(body) ? body : body?.entries
  if (!Array.isArray(list)) {
    return json({ error: 'body must be an array of {key, value, deleted}' }, 400)
  }

  try {
    requireProdConfirm(env, body?.confirmed)
  } catch (e) {
    return routeError(e)
  }

  const next = []
  for (const entry of list) {
    const err = keyNameError(entry?.key)
    if (err) return json({ error: `${err}: ${String(entry?.key)}` }, 400)
    if (entry.deleted) {
      next.push({ key: entry.key, value: null, deleted: true })
    } else if (typeof entry.value !== 'string') {
      return json({ error: `value must be a string: ${entry.key}` }, 400)
    } else {
      next.push({ key: entry.key, value: entry.value, deleted: false })
    }
  }

  try {
    const current = await getCurrentState(g.svc, id, env)
    const changes = replaceChanges(current, next)
    const versionId = await writeVersion(g.svc, {
      projectId: id,
      env,
      actorId: g.user.id,
      actorEmail: g.user.email,
      message: `Bulk update (${next.length} keys)`,
      kind: 'change',
      changes,
    })
    return json({ versionId }, 201)
  } catch (e) {
    return routeError(e)
  }
}
