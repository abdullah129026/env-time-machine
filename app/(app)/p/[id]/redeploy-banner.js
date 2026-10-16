'use client'

import { useEffect, useState } from 'react'

// Exact redeploy steps per platform, because every platform pins env
// vars at build time: a production change is not live until a redeploy.
const STEPS = {
  vercel: [
    'Vercel dashboard, your project, then Deployments.',
    'Open the latest deployment, the ... menu, Redeploy.',
    'Or run `vercel --prod` from the project directory.',
  ],
  render: [
    'Render dashboard, your service, then Manual Deploy.',
    'Choose Deploy latest commit.',
    'A plain restart is not enough: env vars apply at build time.',
  ],
  supabase: [
    'Edge Functions read env vars at deploy time: run `supabase functions deploy <name>`.',
    'For anything else, restart the service that reads the variables.',
  ],
  none: null,
}

// Persistent banner after any production change or rollback. Dismissal is
// stored per project+env+head seq, so it reappears after the next prod change.
export default function RedeployBanner({ projectId, env, headSeq, deployTarget }) {
  const key = `redeploy-dismissed:${projectId}:${env}`
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === String(headSeq))
    } catch {
      setDismissed(false)
    }
  }, [key, headSeq])

  if (env !== 'prod' || headSeq === 0 || dismissed) return null
  const steps = STEPS[deployTarget] ?? null

  function dismiss() {
    try {
      localStorage.setItem(key, String(headSeq))
    } catch {
      // private mode: the banner just comes back next load
    }
    setDismissed(true)
  }

  return (
    <div className="banner" role="status">
      <div>
        <strong>Production changed. Redeploy to apply the new values.</strong>
        {steps ? (
          <ol>
            {steps.map((s, i) => (
              <li key={i} className="mono">
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint" style={{ marginBottom: 0 }}>
            Most platforms pin env vars at build time, so the running app keeps the old values
            until you redeploy. Set the deploy target in Settings for exact steps.
          </p>
        )}
      </div>
      <button className="btn btn-ghost btn-sm" type="button" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  )
}
