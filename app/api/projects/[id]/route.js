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
