import { notFound, redirect } from 'next/navigation'
import { isConfigured, serviceClient } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'
import { requireMembership, MembershipError } from '@/lib/membership'
import { getCurrentState, maskState } from '@/lib/env'
import ProjectView from './project-view'

const ENVS = ['dev', 'staging', 'prod']
const TABS = ['secrets', 'history', 'activity', 'settings']

export default async function ProjectPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const env = ENVS.includes(sp?.env) ? sp.env : 'dev'
  const tab = TABS.includes(sp?.tab) ? sp.tab : 'secrets'
  const keyFilter = typeof sp?.key === 'string' ? sp.key : ''
  const seqFilter = Number.isInteger(parseInt(sp?.seq, 10)) ? parseInt(sp.seq, 10) : null

  if (!isConfigured()) {
    return (
      <>
        <div className="page-head"><div><h1>Project</h1></div></div>
        <div className="notice">Supabase is not configured yet. Add the env vars and redeploy.</div>
      </>
    )
  }

  const supabase = await serverClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  const svc = serviceClient()
  try {
    await requireMembership(svc, id, data.user.id)
  } catch (e) {
    if (e instanceof MembershipError) notFound()
    throw e
  }

  const { data: project } = await svc
    .from('projects')
    .select('id, name, deploy_target')
    .eq('id', id)
    .single()
  if (!project) notFound()

  const { data: environments } = await svc
    .from('environments')
    .select('name, version_seq')
    .eq('project_id', id)
  const headSeq = environments?.find((e) => e.name === env)?.version_seq ?? 0

  // current state, masked server-side; plaintext never reaches the page
  const state = await getCurrentState(svc, id, env)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{project.name}</h1>
          <p>Every action below is scoped to the selected environment.</p>
        </div>
      </div>

      <ProjectView
        projectId={id}
        env={env}
        tab={tab}
        keyFilter={keyFilter}
        seqFilter={seqFilter}
        initialHeadSeq={headSeq}
        deployTarget={project.deploy_target ?? 'none'}
        initialEntries={maskState(state)}
      />
    </>
  )
}
