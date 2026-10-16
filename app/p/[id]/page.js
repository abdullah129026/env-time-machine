import { notFound, redirect } from 'next/navigation'
import { isConfigured, serviceClient } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'
import { requireMembership, MembershipError } from '@/lib/membership'
import { getCurrentState, maskState } from '@/lib/env'
import SecretsView from './secrets-view'

const ENVS = ['dev', 'staging', 'prod']

export default async function ProjectPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const env = ENVS.includes(sp?.env) ? sp.env : 'dev'

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

  const { data: project } = await svc.from('projects').select('id, name').eq('id', id).single()
  if (!project) notFound()

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

      <div className="env-bar">
        {ENVS.map((e) => (
          <a
            key={e}
            href={`/p/${id}?env=${e}`}
            className={`env-tab${e === env ? ' active' : ''}${e === 'prod' ? ' prod' : ''}`}
          >
            {e}
          </a>
        ))}
      </div>

      <SecretsView projectId={id} env={env} initialEntries={maskState(state)} />
    </>
  )
}
