import Reveal from '@/components/Reveal'

export const metadata = {
  title: 'Security — Env Time Machine',
  description: 'How Env Time Machine protects your secrets: encryption, masking, audit logging, and honest limits.',
}

const SECTIONS = [
  {
    title: 'Encryption at rest',
    copy: 'Secret values are encrypted at rest on the platform. They are decrypted in memory only when you open a viewer, and the plaintext is discarded when the viewer closes. A value never sits in a long-lived store.',
  },
  {
    title: 'Masked by default',
    copy: 'Values render as bullets everywhere: tables, diffs, history. Reveal is click-only, never hover, so shoulder-surfers and tooltip previews get nothing. Copy is a separate, deliberate action.',
  },
  {
    title: 'Clipboard hygiene',
    copy: 'Copied secrets clear from the clipboard after 30 seconds. Nothing lingers to be pasted into the wrong chat window.',
  },
  {
    title: 'Audit everything',
    copy: 'Every read and write lands in the audit log: who, when, what changed, from where. Reveal and copy count as read events. Values never appear in the records themselves, and error responses are scanned for leakage before they render.',
  },
  {
    title: 'Access control on every route',
    copy: 'Membership is checked on every API route and every page. There is no unauthenticated path to a value, and every mutation path (UI, import, rollback, sync) writes its audit entry.',
  },
]

export default function SecurityPage() {
  return (
    <div className="landing">
      <div className="landing-inner" style={{ paddingTop: 96, paddingBottom: 96, maxWidth: 760 }}>
        <Reveal>
          <div className="landing-kicker">SECURITY</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Trust is the product.
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 17, margin: '0 0 48px' }}>
            Storing other people&apos;s secrets is the highest-trust ask in software. Here is
            exactly what we do with yours, and where the limits are.
          </p>
        </Reveal>
        <div className="sec-list" style={{ margin: '0 0 48px' }}>
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={i * 60}>
              <div className="sec-item">
                <span className="tick">✓</span>
                <p>
                  <strong>{s.title}.</strong> {s.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="card">
            <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Honest limits</h2>
            <div style={{ color: 'var(--text-dim)', fontSize: 14, display: 'grid', gap: 8 }}>
              <p style={{ margin: 0 }}>
                The database is encrypted at rest by the hosting platform. We do not do our
                own envelope encryption yet, which means anyone with the project&apos;s
                service_role key (and the platform operator) can read values. Masking is a
                display rule, not encryption. Per-project keys are the documented upgrade
                path, and they will ship before any claim otherwise.
              </p>
              <p style={{ margin: 0 }}>
                Old versions and audit events are deleted after 90 days by a nightly purge;
                the current state is never touched. Deleting a project deletes everything
                with it. There is no backup of deleted secrets anywhere in v1.
              </p>
              <p style={{ margin: 0 }}>
                Saying the limit out loud builds more trust than a badge wall.
              </p>
            </div>
          </div>
          <p style={{ marginTop: 32 }}>
            <a className="btn" href="/signup">Start free</a>
          </p>
        </Reveal>
      </div>
    </div>
  )
}
