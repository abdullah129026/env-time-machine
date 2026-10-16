import LandingNav from '@/components/LandingNav'
import HeroDemo from '@/components/HeroDemo'
import Reveal from '@/components/Reveal'

export const metadata = {
  title: 'Env Time Machine — Git history for your env vars',
  description:
    'Every env change diffed, attributed, and one click away from rollback. Import your .env and see your first diff in under a minute.',
}

const INCIDENTS = [
  {
    when: '2026-04 · post-mortem',
    story: 'A Redis connection string changed without review at 3:52 PM. By 5 PM, 4,000 users were logged out.',
    would: 'The diff would have shown exactly who changed it and what the old value was.',
  },
  {
    when: 'node rotation · 502s',
    story: 'Checkout pods returned 502s after a node rotation. The env var existed only on the replaced nodes, set once via a console, never written down.',
    would: 'The history would have had the value. One click restores it.',
  },
  {
    when: 'missing .env.example line',
    story: 'The variable existed on the developer machine but never made it to production. Tests, review, and build all passed. Production found it.',
    would: 'Startup validation against the contract catches it before deploy, not after.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Import your .env',
    copy: 'Paste or upload your file. Keys are parsed, values masked on sight. Your first diff appears in under a minute.',
    visual: (
      <>
        <div><span className="typed">$ etm import .env</span></div>
        <div style={{ marginTop: 8 }}>parsed 14 keys · 0 parse errors</div>
        <div>values masked <span className="bullets">••••••••</span></div>
      </>
    ),
  },
  {
    n: '02',
    title: 'Every change becomes a version',
    copy: 'Edit a value and a commit entry appears with your name, a timestamp, and the diff. Nothing is ever overwritten.',
    visual: (
      <>
        <div><span className="v" style={{ color: 'var(--accent)' }}>v16</span> STRIPE_KEY updated · you · just now</div>
        <div style={{ marginTop: 8 }}><span className="v" style={{ color: 'var(--accent)' }}>v15</span> LOG_LEVEL added · ana · 2h ago</div>
        <div><span className="v" style={{ color: 'var(--accent)' }}>v14</span> DATABASE_URL updated · you · 1d ago</div>
      </>
    ),
  },
  {
    n: '03',
    title: 'Roll back in one click',
    copy: 'Pick any version and confirm exactly which keys will change. The rollback appends a new version, so undoing the rollback is one more click.',
    visual: (
      <>
        <div>restore <span className="typed">v14</span> to prod?</div>
        <div style={{ marginTop: 8 }}><span className="badge badge-updated">updated</span> STRIPE_KEY</div>
        <div><span className="badge badge-added">added</span> LOG_LEVEL</div>
      </>
    ),
  },
]

const BENTO = [
  {
    title: 'Diffs on every plan, not just Enterprise',
    copy: 'Vercel shows who changed what but hides the before/after behind Enterprise. Here every change shows its diff, on every plan.',
    wide: true,
    visual: (
      <>
        <div className="diff-row"><span className="badge badge-updated">updated</span><span>DATABASE_URL</span></div>
        <div className="diff-row"><span className="diff-old">••••••••</span><span>→</span><span className="diff-new">••••••••</span></div>
      </>
    ),
  },
  {
    title: 'One-click rollback that respects production',
    copy: 'Dev and staging get an undo toast. Production gets a confirm dialog listing exactly which keys change. Never the other way around.',
    wide: true,
  },
  {
    title: 'Masked by default',
    copy: 'Values render as bullets. Reveal is click-only, never hover, and every reveal is an audited read event.',
  },
  {
    title: '30-second clipboard scrub',
    copy: 'Copied secrets clear from the clipboard automatically. Nothing lingers to be pasted into the wrong chat.',
  },
  {
    title: 'Audit log of everything',
    copy: 'Every read and write lands in the log: who, when, what changed. Values never appear in the records.',
  },
  {
    title: 'Vercel sync',
    copy: 'Push the current version straight to your Vercel project. No more console copy-paste.',
  },
]

const SECURITY = [
  'Server-side encryption at rest. Values are decrypted in memory only and discarded when the viewer closes.',
  'Values never appear in logs, audit records, or error responses. The log records the fact of access, never the secret.',
  'Reveal and copy are treated as audited read events: who, when, from where.',
  'Reads and writes go through membership checks on every route. There is no unauthenticated path to a value.',
]

export default function LandingPage() {
  return (
    <div className="landing">
      <LandingNav />

      <section className="landing-hero">
        <div className="landing-inner">
          <Reveal>
            <div className="landing-kicker">VERSION CONTROL FOR ENV FILES</div>
          </Reveal>
          <Reveal delay={80}>
            <h1>Every env change, diffed and one click from rollback.</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="sub">
              Someone deletes a variable, production crashes, and nobody knows what the old
              value was. Never again.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="landing-ctas">
              <a className="btn" href="/signup">Start free</a>
              <a className="btn btn-ghost" href="#how">See how it works</a>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <HeroDemo />
          </Reveal>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <Reveal>
            <h2>This keeps happening.</h2>
            <p className="lede">Real incidents, real post-mortems. Every one of them is a missing diff.</p>
          </Reveal>
          <div className="incident-grid">
            {INCIDENTS.map((c, i) => (
              <Reveal key={c.when} delay={i * 90}>
                <div className="incident-card">
                  <div className="when">{c.when}</div>
                  <p>{c.story}</p>
                  <p className="would">{c.would}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="how">
        <div className="landing-inner">
          <Reveal>
            <h2>How it works</h2>
            <p className="lede">Three steps. The product does the remembering so you don&apos;t have to.</p>
          </Reveal>
          {STEPS.map((s, i) => (
            <div className="hiw-row" key={s.n}>
              <Reveal>
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </Reveal>
              <Reveal delay={120}>
                <div className="hiw-visual">{s.visual}</div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <Reveal>
            <h2>Built for the way teams actually break prod.</h2>
            <p className="lede">The features that matter when it is 2am and checkout is down.</p>
          </Reveal>
          <div className="bento">
            {BENTO.map((b, i) => (
              <Reveal key={b.title} delay={(i % 2) * 90}>
                <div className="landing-card">
                  <h3>{b.title}</h3>
                  <p>{b.copy}</p>
                  {b.visual && <div className="mini">{b.visual}</div>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="security">
        <div className="landing-inner">
          <Reveal>
            <h2>Trust is the product.</h2>
            <p className="lede">Storing secrets is the highest-trust ask in software. Here is exactly what we do with yours.</p>
          </Reveal>
          <div className="sec-list">
            {SECURITY.map((s, i) => (
              <Reveal key={s} delay={i * 80}>
                <div className="sec-item">
                  <span className="tick">✓</span>
                  <p>
                    {s}
                    {i === 0 && (
                      <span className="honest">
                        Honest limit: v1 uses platform-managed encryption. Per-project keys are on the roadmap.
                      </span>
                    )}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-inner">
          <Reveal>
            <h2>Flat pricing.</h2>
            <p className="lede">We do not charge per seat like Doppler ($21/user/mo) or per identity like Infisical ($18/identity/mo).</p>
          </Reveal>
          <div className="price-grid">
            <Reveal>
              <div className="landing-card price-card">
                <h3>Free</h3>
                <div className="amount">$0<small>/mo</small></div>
                <ul>
                  <li>1 project</li>
                  <li>90-day history</li>
                  <li>Diffs on every change</li>
                </ul>
                <a className="btn btn-ghost" href="/signup">Start free</a>
              </div>
            </Reveal>
            <Reveal delay={90}>
              <div className="landing-card price-card featured">
                <h3>Team</h3>
                <div className="amount">$12<small>/mo flat</small></div>
                <ul>
                  <li>Unlimited projects</li>
                  <li>1-year history</li>
                  <li>Vercel sync</li>
                  <li>Audit log export</li>
                </ul>
                <a className="btn" href="/signup">Start free</a>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="landing-card price-card">
                <h3>Self-hosted</h3>
                <div className="amount">$0<small> forever</small></div>
                <ul>
                  <li>Bring your own Postgres</li>
                  <li>Same dashboard</li>
                  <li>You hold the keys</li>
                </ul>
                <a className="btn btn-ghost" href="/signup">Start free</a>
              </div>
            </Reveal>
          </div>
          <p className="price-note">
            <a href="/pricing">Full pricing and the competitor comparison →</a>
          </p>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-inner">
          <Reveal>
            <h2>Stop debugging env vars at 2am.</h2>
            <a className="btn" href="/signup" style={{ padding: '12px 28px', fontSize: 15 }}>Start free</a>
          </Reveal>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-inner">
          <div className="cols">
            <div>
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="/pricing">Pricing</a>
              <a href="/security">Security</a>
            </div>
            <div>
              <h4>Resources</h4>
              <a href="/signup">Get started</a>
              <a href="/login">Sign in</a>
            </div>
            <div>
              <h4>Compare</h4>
              <a href="/pricing">vs Doppler</a>
              <a href="/pricing">vs Infisical</a>
              <a href="/pricing">vs Vault</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="/security">Terms</a>
              <a href="/security">Privacy</a>
            </div>
          </div>
          <span className="status-dot"><span className="dot" />All systems operational</span>
          <p className="copyright">© 2026 Env Time Machine</p>
        </div>
      </footer>
    </div>
  )
}
