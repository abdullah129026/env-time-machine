'use client'

import { useCallback, useState } from 'react'
import SecretsView from './secrets-view'
import HistoryView from './history-view'
import SettingsView from './settings-view'
import RedeployBanner from './redeploy-banner'

const ENVS = ['dev', 'staging', 'prod']
const TABS = [
  { id: 'secrets', label: 'Secrets' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

// Client half of the project view. Tabs are links (env is preserved across
// them), headSeq is kept live so the redeploy banner reappears right after
// a production write or rollback.
export default function ProjectView({ projectId, env, tab, keyFilter, initialHeadSeq, deployTarget, initialEntries }) {
  const [headSeq, setHeadSeq] = useState(initialHeadSeq)

  const refreshHead = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return
      const data = await res.json()
      const row = (data.environments ?? []).find((e) => e.name === env)
      if (row) setHeadSeq(row.version_seq)
    } catch {
      // banner staleness is cosmetic; the next load fixes it
    }
  }, [projectId, env])

  const tabQuery = (t, e) =>
    `/p/${projectId}?env=${e}&tab=${t}${t === 'history' && keyFilter ? `&key=${encodeURIComponent(keyFilter)}` : ''}`

  return (
    <>
      {env === 'prod' && (
        <div className="prod-strip">
          Production environment. Every write needs confirmation, and values pin at build
          time until you redeploy.
        </div>
      )}

      <RedeployBanner projectId={projectId} env={env} headSeq={headSeq} deployTarget={deployTarget} />

      <div className="tabs">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={tabQuery(t.id, env)}
            className={`tab${t.id === tab ? ' active' : ''}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'secrets' && (
        <SecretsView projectId={projectId} env={env} initialEntries={initialEntries} onMutated={refreshHead} />
      )}
      {tab === 'history' && (
        <HistoryView projectId={projectId} env={env} initialKey={keyFilter} onMutated={refreshHead} />
      )}
      {tab === 'settings' && <SettingsView projectId={projectId} initialTarget={deployTarget} />}
    </>
  )
}
