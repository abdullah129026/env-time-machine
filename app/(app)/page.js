import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isConfigured, serviceClient } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'

async function currentUser() {
  const supabase = await serverClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export default async function Home() {
  if (!isConfigured()) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Projects</h1>
          </div>
        </div>
        <div className="notice">Supabase is not configured yet. Add the env vars and redeploy.</div>
      </>
    )
  }

  const user = await currentUser()
  if (!user) redirect('/login')

  const svc = serviceClient()
  const { data: memberships } = await svc
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
  const ids = (memberships ?? []).map((m) => m.project_id)
  const { data: projects } = ids.length
    ? await svc.from('projects').select('id, name, created_at').in('id', ids).order('created_at', { ascending: false })
    : { data: [] }

  async function createProject(formData) {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    if (!name) return
    const user = await currentUser()
    if (!user) redirect('/login')
    const svc = serviceClient()
    const { data: projectId, error } = await svc.rpc('create_project', {
      p_name: name,
      p_owner_id: user.id,
      p_owner_email: user.email ?? '',
    })
    if (error || !projectId) throw new Error('Could not create the project. Please try again.')
    revalidatePath('/')
    redirect(`/p/${projectId}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p>Each project versions env vars across dev, staging, and prod.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form action={createProject}>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="name">New project</label>
              <input id="name" name="name" type="text" maxLength={80} placeholder="my-api" required />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn" type="submit">Create</button>
            </div>
          </div>
        </form>
      </div>

      {(projects ?? []).length === 0 ? (
        <div className="empty">
          <h2>No projects yet</h2>
          <p>Create your first project above to start versioning env vars.</p>
        </div>
      ) : (
        <div className="list">
          {projects.map((p) => (
            <a key={p.id} className="list-item" href={`/p/${p.id}`}>
              <div className="name">{p.name}</div>
              <div className="meta mono">created {new Date(p.created_at).toLocaleDateString()}</div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
