// Shared API route gate: service configured -> env name known -> signed in
// -> project member. Every route starts here; service_role bypasses RLS,
// so the membership check is the trust boundary.
import { NextResponse } from 'next/server'
import { serviceClient, serviceConfigured } from './supabase.js'
import { serverClient } from './supabase-server.js'
import { requireMembership, MembershipError } from './membership.js'
import { ENVS, InputError } from './env.js'

export const json = (data, status = 200) => NextResponse.json(data, { status })

// gate(projectId, envName) -> { svc, user } or { error: Response }.
// envName may be omitted for project-level routes.
export async function gate(projectId, envName) {
  if (!serviceConfigured()) return { error: json({ error: 'Supabase is not configured' }, 503) }
  if (envName !== undefined && !ENVS.includes(envName)) {
    return { error: json({ error: 'unknown environment' }, 404) }
  }

  const supabase = await serverClient()
  const { data } = supabase ? await supabase.auth.getUser() : { data: {} }
  if (!data?.user) return { error: json({ error: 'sign in required' }, 401) }

  const svc = serviceClient()
  try {
    await requireMembership(svc, projectId, data.user.id)
  } catch (e) {
    if (e instanceof MembershipError) return { error: json({ error: e.message }, 403) }
    return { error: json({ error: 'could not check membership' }, 500) }
  }
  return { svc, user: data.user }
}

// Route-level error mapping: input problems are 400, everything else is a
// generic 500. Error responses never carry values, so details stay server-side.
export function routeError(e) {
  if (e instanceof InputError) return json({ error: e.message }, e.status)
  return json({ error: 'request failed' }, 500)
}
