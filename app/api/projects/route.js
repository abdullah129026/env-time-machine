import { NextResponse } from 'next/server'
import { serviceClient, serviceConfigured } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'

const json = (data, status = 200) => NextResponse.json(data, { status })

async function authedUser() {
  const supabase = await serverClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function GET() {
  if (!serviceConfigured()) return json({ error: 'Supabase is not configured' }, 503)
  const user = await authedUser()
  if (!user) return json({ error: 'sign in required' }, 401)

  const svc = serviceClient()
  const { data: memberships, error: mErr } = await svc
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
  if (mErr) return json({ error: 'could not load projects' }, 500)

  const ids = memberships.map((m) => m.project_id)
  if (!ids.length) return json({ projects: [] })
  const { data: projects, error } = await svc
    .from('projects')
    .select('id, name, deploy_target, created_at')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) return json({ error: 'could not load projects' }, 500)
  return json({ projects })
}

export async function POST(request) {
  if (!serviceConfigured()) return json({ error: 'Supabase is not configured' }, 503)
  const user = await authedUser()
  if (!user) return json({ error: 'sign in required' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return json({ error: 'name is required' }, 400)
  if (name.length > 80) return json({ error: 'name is too long' }, 400)

  const svc = serviceClient()
  const { data: projectId, error } = await svc.rpc('create_project', {
    p_name: name,
    p_owner_id: user.id,
    p_owner_email: user.email ?? '',
  })
  if (error || !projectId) return json({ error: 'could not create project' }, 500)
  const { data: project } = await svc
    .from('projects')
    .select('id, name, deploy_target, created_at')
    .eq('id', projectId)
    .single()
  return json({ project }, 201)
}
