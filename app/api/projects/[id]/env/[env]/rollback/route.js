import { gate, json, routeError } from '@/lib/guard'
import { rollbackVersion, HeadMovedError } from '@/lib/env'

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

  try {
    const { versionId, seq } = await rollbackVersion(g.svc, {
      projectId: id,
      env,
      actorId: g.user.id,
      actorEmail: g.user.email,
      targetVersionId: body?.targetVersionId,
      headSeq: body?.headSeq,
      confirmed: body?.confirmed,
    })
    return json({ versionId, seq }, 201)
  } catch (e) {
    // the head moved under the confirm dialog: hand back the fresh diff
    // so the client can re-render and ask for confirmation again
    if (e instanceof HeadMovedError) {
      return json(
        {
          error: 'head_moved',
          message: 'someone changed this environment since the dialog was rendered, review and confirm again',
          currentSeq: e.currentSeq,
          diff: e.diff,
        },
        409
      )
    }
    return routeError(e)
  }
}
