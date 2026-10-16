import { gate, json, routeError } from '@/lib/guard'
import { getCurrentState, writeVersion, keyNameError } from '@/lib/env'

export async function POST(request, { params }) {
  const { id, env } = await params
  const g = await gate(id, env)
  if (g.error) return g.error

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const keyErr = keyNameError(body?.key)
  if (keyErr) return json({ error: keyErr }, 400)
  const key = body.key
  const isDelete = body.deleted === true

  let value = ''
  if (!isDelete) {
    if (typeof body.value !== 'string') return json({ error: 'value must be a string' }, 400)
    value = body.value
  }

  try {
    const current = await getCurrentState(g.svc, id, env)
    const exists = current.some((e) => e.key === key)
    const message = isDelete ? `Delete ${key}` : exists ? `Update ${key}` : `Add ${key}`
    const versionId = await writeVersion(g.svc, {
      projectId: id,
      env,
      actorId: g.user.id,
      actorEmail: g.user.email,
      message,
      kind: 'change',
      changes: [{ key, value: isDelete ? null : value, deleted: isDelete }],
    })
    return json({ versionId }, 201)
  } catch (e) {
    return routeError(e)
  }
}
