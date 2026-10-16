'use client'

import Link from 'next/link'
import { useEffect } from 'react'

// Root error boundary: branded 500 page. Logs the error for diagnostics;
// the user sees a calm message and a way back.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="landing">
          <div className="landing-inner" style={{ paddingTop: 140, paddingBottom: 140, textAlign: 'center' }}>
            <div className="landing-kicker">500</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
              Something broke on our end.
            </h1>
            <p style={{ color: 'var(--text-dim)', margin: '0 0 28px' }}>
              Your data is safe. Try again, or head back to your projects.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn" type="button" onClick={() => reset()}>
                Try again
              </button>
              <Link className="btn btn-ghost" href="/">Back to projects</Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
