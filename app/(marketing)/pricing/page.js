import Reveal from '@/components/Reveal'

export const metadata = {
  title: 'Pricing — Env Time Machine',
  description: 'Flat pricing for env var version control. No per-seat or per-identity billing.',
}

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    per: '/mo',
    features: ['1 project', '3 environments', '90-day history', 'Diffs on every change', 'One-click rollback'],
    cta: 'Start free',
  },
  {
    name: 'Team',
    price: '$12',
    per: '/mo flat',
    features: ['Unlimited projects', '1-year history', 'Vercel sync', 'Audit log export', 'Priority support'],
    cta: 'Start free',
    featured: true,
  },
  {
    name: 'Self-hosted',
    price: '$0',
    per: ' forever',
    features: ['Bring your own Postgres', 'Same dashboard', 'You hold the keys', 'MIT-licensed core'],
    cta: 'Start free',
  },
]

const COMPARE = [
  { name: 'Env Time Machine (Team)', price: '$12/mo flat', diffs: 'Yes, all plans', rollback: 'One click' },
  { name: 'Doppler (Team)', price: '$21/user/mo', diffs: 'Change requests, paid', rollback: 'One click' },
  { name: 'Infisical (Pro)', price: '$18/identity/mo', diffs: 'Yes', rollback: 'Point-in-time recovery' },
  { name: 'HashiCorp Vault', price: 'Cluster + license', diffs: 'No', rollback: 'Manual' },
  { name: 'AWS Secrets Manager', price: '$0.40/secret/mo', diffs: 'No', rollback: 'Manual' },
]

export default function PricingPage() {
  return (
    <div className="landing">
      <div className="landing-inner" style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Reveal>
          <div className="landing-kicker" style={{ textAlign: 'center' }}>PRICING</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px', textAlign: 'center' }}>
            Flat pricing. No per-seat math.
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 17, margin: '0 0 48px', textAlign: 'center' }}>
            Doppler charges per user, Infisical per identity. We charge per team.
          </p>
        </Reveal>
        <div className="price-grid">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <div className={`landing-card price-card${t.featured ? ' featured' : ''}`}>
                <h3>{t.name}</h3>
                <div className="amount">{t.price}<small>{t.per}</small></div>
                <ul>
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a className={`btn${t.featured ? '' : ' btn-ghost'}`} href="/signup">{t.cta}</a>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <h2 style={{ fontSize: 24, margin: '64px 0 8px', textAlign: 'center' }}>How we compare</h2>
          <p style={{ color: 'var(--text-dim)', textAlign: 'center', margin: '0 0 8px' }}>
            Public pricing as of 2026. Verify on each vendor&apos;s site before deciding.
          </p>
          <table className="compare-tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Price</th>
                <th>Diffs</th>
                <th>Rollback</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong></td>
                  <td className="num mono">{c.price}</td>
                  <td>{c.diffs}</td>
                  <td>{c.rollback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </div>
  )
}
