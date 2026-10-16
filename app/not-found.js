import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="landing">
      <div className="landing-inner" style={{ paddingTop: 140, paddingBottom: 140, textAlign: 'center' }}>
        <div className="landing-kicker">404</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
          This page does not exist.
        </h1>
        <p style={{ color: 'var(--text-dim)', margin: '0 0 28px' }}>
          It may have been moved, or the link is wrong. Your env vars are fine.
        </p>
        <Link className="btn" href="/">Back to projects</Link>
      </div>
    </div>
  )
}
