import { gate, json } from '@/lib/guard'
import { getCurrentState, keyNameError } from '@/lib/env'

export async function GET(request, { params }) {
  const { id, env } = await params
  const g = await gate(id, env)
  if (g.error) return g.error

  const key = new URL(request.url).searchParams.get('key')
  const keyErr = keyNameError(key)
  if (keyErr) return json({ error: keyErr }, 400)

  try {
    const state = await getCurrentState(g.svc, id, env)
    const row = state.find((e) => e.key === key)
    if (!row) return json({ error: 'key not found' }, 404)

    // best-effort read audit: the read already happened, so a failed
    // insert must never block the response. Never stores the value.
    try {
      const { data: envRow } = await g.svc
        .from('environments')
        .select('id')
        .eq('project_id', id)
        .eq('name', env)
        .maybeSingle()
      await g.svc.from('audit_events').insert({
        project_id: id,
        environment_id: envRow?.id ?? null,
        actor_id: g.user.id,
        actor_email: g.user.email ?? '',
        action: 'reveal',
        target_key: key,
        details: {},
      })
    } catch (auditErr) {
      console.error('reveal audit insert failed:', auditErr?.message ?? auditErr)
    }

    return json({ key, value: row.value })
  } catch {
    return json({ error: 'could not reveal value' }, 500)
  }
}
