// Membership gate. service_role bypasses RLS, so every API route starts here:
// no project_members row means 403, before any data is touched.
export class MembershipError extends Error {
  constructor(message = 'not a member of this project') {
    super(message)
    this.name = 'MembershipError'
    this.status = 403
  }
}

export async function requireMembership(serviceClient, projectId, userId) {
  if (!projectId || !userId) throw new MembershipError()
  const { data, error } = await serviceClient
    .from('project_members')
    .select('project_id, user_id, role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new MembershipError()
  return data
}
