import { Suspense } from 'react'
import { isConfigured, serviceClient } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'
import { ProjectSwitcher, UserMenu } from '@/components/SidebarExtras'
import Topbar from '@/components/Topbar'

// Dashboard shell: sidebar (project switcher, nav, user menu) plus the
// slim topbar with breadcrumb and Cmd+K. Marketing pages use the
// (marketing) group and never see this chrome.
export default async function AppLayout({ children }) {
  let email = ''
  let projects = []
  if (isConfigured()) {
    const supabase = await serverClient()
    const { data } = (await supabase?.auth.getUser()) ?? {}
    const user = data?.user ?? null
    email = user?.email ?? ''
    if (user) {
      const svc = serviceClient()
      if (svc) {
        const { data: memberships } = await svc
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id)
        const ids = (memberships ?? []).map((m) => m.project_id)
        if (ids.length) {
          const { data: rows } = await svc
            .from('projects')
            .select('id, name')
            .in('id', ids)
            .order('created_at', { ascending: false })
          projects = rows ?? []
        }
      }
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: 'var(--accent)', verticalAlign: '-4px', marginRight: 8 }} />
          env time machine
        </a>
        <ProjectSwitcher projects={projects} />
        <nav>
          <a className="nav-link" href="/">Projects</a>
          <a className="nav-link" href="/pricing">Pricing</a>
          <a className="nav-link" href="/security">Security</a>
        </nav>
        <UserMenu email={email} />
      </aside>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Suspense>
          <Topbar projects={projects} email={email} />
        </Suspense>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
