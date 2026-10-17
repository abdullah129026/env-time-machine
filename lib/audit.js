// Activity log reads. Audit rows never contain values, only ids,
// counts, and messages, so every field here is safe to serialize.
// Filters are all optional: actor (substring on actor_email), action
// (exact, whitelisted), env (dev/staging/prod), since/until (ISO dates).
// Newest first, capped.
import { ENVS, InputError } from './env.js'

export const AUDIT_ACTIONS = [
  'create',
  'change',
  'update',
  'delete',
  'reveal',
  'copy',
  'rollback',
  'import',
]

const EVENT_LIMIT = 100

export async function listAuditEvents(
  svc,
  projectId,
  { actor = '', action = '', env = '', since = '', until = '', limit = EVENT_LIMIT } = {}
) {
  if (action && !AUDIT_ACTIONS.includes(action)) throw new InputError('unknown action')
  if (env && !ENVS.includes(env)) throw new InputError('unknown environment')

  let envId = null
  if (env) {
    const { data, error } = await svc
      .from('environments')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', env)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new InputError('unknown environment')
    envId = data.id
  }

  const sinceDate = since ? new Date(since) : null
  const untilDate = until ? new Date(until) : null
  if ((sinceDate && Number.isNaN(sinceDate.getTime())) || (untilDate && Number.isNaN(untilDate.getTime()))) {
    throw new InputError('bad date')
  }

  // one query; the environments() join names each event's environment.
  // project_id is always filtered: this is the same trust boundary as
  // the route's membership gate.
  let q = svc
    .from('audit_events')
    .select('id, created_at, actor_email, action, environment_id, target_key, details, environments(name)')
    .eq('project_id', projectId)
  const a = actor.trim()
  if (a) q = q.ilike('actor_email', `%${a}%`)
  if (action) q = q.eq('action', action)
  if (envId) q = q.eq('environment_id', envId)
  if (sinceDate) q = q.gte('created_at', sinceDate.toISOString())
  if (untilDate) q = q.lte('created_at', untilDate.toISOString())
  q = q.order('created_at', { ascending: false }).limit(Math.min(Number(limit) || EVENT_LIMIT, 200))

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((e) => ({
    id: e.id,
    created_at: e.created_at,
    actor_email: e.actor_email,
    action: e.action,
    env: e.environments?.name ?? null,
    target_key: e.target_key,
    version_id: e.details?.version_id ?? null,
    seq: e.details?.seq ?? null,
    change_count: e.details?.change_count ?? null,
    message: e.details?.message ?? null,
  }))
}
