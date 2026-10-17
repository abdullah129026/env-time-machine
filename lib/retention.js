// 90-day retention enforcement. The purge deletes versions older than
// 90 days, always keeping each environment's head, plus audit events
// older than 90 days. variable_states rows cascade from versions. The
// head is excluded by seq (monotonic per environment), so the current
// state is never touched. Returns the cutoff and what was removed.
export const RETENTION_DAYS = 90

export async function purgeOldData(svc, { now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: envs, error: envErr } = await svc.from('environments').select('id, version_seq')
  if (envErr) throw envErr

  let deletedVersions = 0
  for (const env of envs ?? []) {
    const { data, error } = await svc
      .from('versions')
      .delete()
      .eq('environment_id', env.id)
      .lt('seq', env.version_seq) // never the head
      .lt('created_at', cutoff)
    if (error) throw error
    deletedVersions += (data ?? []).length
  }

  const { data: audits, error: auditErr } = await svc
    .from('audit_events')
    .delete()
    .lt('created_at', cutoff)
  if (auditErr) throw auditErr

  return {
    cutoff,
    deleted_versions: deletedVersions,
    deleted_audit_events: (audits ?? []).length,
  }
}
