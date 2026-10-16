import { gate, json, routeError } from '@/lib/guard'
import { previewImport, applyImport, InputError } from '@/lib/env'

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
  if (typeof body?.text !== 'string') return json({ error: 'text is required' }, 400)

  // preview parses and diffs without writing anything
  if (body.preview === true) {
    try {
      const preview = await previewImport(g.svc, id, env, body.text)
      return json(preview)
    } catch (e) {
      return routeError(e)
    }
  }

  // apply: replace semantics, one version, kind 'import'
  try {
    const versionId = await applyImport(g.svc, {
      projectId: id,
      envName: env,
      actorId: g.user.id,
      actorEmail: g.user.email,
      text: body.text,
      apply: body.apply,
    })
    return json({ versionId }, 201)
  } catch (e) {
    if (e instanceof InputError) return json({ error: e.message }, e.status)
    return json({ error: 'import failed' }, 500)
  }
}
