import { NextResponse } from 'next/server'
import { serviceClient, serviceConfigured } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'
import { requireMembership, MembershipError } from '@/lib/membership'

const json = (data, status = 200) => NextResponse.json(data, { status })

export async function GET(_request, { params }) {
  const { id } = await params
  if (!serviceConfigured()) return json({ error: 'Supabase is not configured' }, 503)

  const supabase = await serverClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json({ error: 'sign in required' }, 401)

  const svc = serviceClient()
  try {
    await requireMembership(svc, id, data.user.id)
  } catch (e) {
    if (e instanceof MembershipError) return json({ error: e.message }, { status: e.status })
    return json({ error: 'could not check membership' }, 500)
  }

  const { data: project, error } = await svc
    .from('projects')
    .select('id, name, deploy_target, created_at')
    .eq('id', id)
    .single()
  if (error || !project) return json({ error: 'project not found' }, 404)

  const { data: environments } = await svc
    .from('environments')
    .select('id, name, version_seq')
    .eq('project_id', id)
    .order('name')
  return json({ project, environments: environments ?? [] })
}

const DEPLOY_TARGETS = ['vercel', 'render', 'supabase', 'none']

// Minimal settings: the deploy target drives the redeploy banner copy
// after production changes. Owner-only.
export async function PATCH(request, { params }) {
  const { id } = await params
  if (!serviceConfigured()) return json({ error: 'Supabase is not configured' }, 503)

  const supabase = await serverClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json({ error: 'sign in required' }, 401)

  const svc = serviceClient()
  try {
    await requireMembership(svc, id, data.user.id)
  } catch (e) {
    if (e instanceof MembershipError) return json({ error: e.message }, { status: e.status })
    return json({ error: 'could not check membership' }, 500)
  }

  const { data: member } = await svc
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (member?.role !== 'owner') return json({ error: 'only owners can change settings' }, 403)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  if (!DEPLOY_TARGETS.includes(body?.deploy_target)) {
    return json({ error: `deploy_target must be one of: ${DEPLOY_TARGETS.join(', ')}` }, 400)
  }

  const { error } = await svc
    .from('projects')
    .update({ deploy_target: body.deploy_target })
    .eq('id', id)
  if (error) return json({ error: 'could not save settings' }, 500)
  return json({ deploy_target: body.deploy_target })
}
