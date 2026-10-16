'use client'

import { useEffect, useRef, useState } from 'react'

// Hero product demo: a .env diff with a rollback that plays itself on a
// 6s loop. Pauses offscreen via IntersectionObserver, restarts on re-entry.
// Reduced motion: shows the end frame, no loop.
const CYCLE = 6000

const COMMITS = [
  { v: 'v15', msg: 'Rollback to v14', who: 'you', when: 'just now' },
  { v: 'v14', msg: 'STRIPE_KEY rotated', who: 'ana', when: '2h ago' },
  { v: 'v13', msg: 'DATABASE_URL updated', who: 'you', when: '1d ago' },
]

export default function HeroDemo() {
  const ref = useRef(null)
  const [cycle, setCycle] = useState(0)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPressed(true)
      return
    }
    let timer = null
    let pressTimer = null
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting)
        clearInterval(timer)
        clearTimeout(pressTimer)
        if (vis) {
          // each cycle: press at 2.2s, new commit row lands, hold, reset
          pressTimer = setTimeout(() => setPressed(true), 2200)
          timer = setInterval(() => {
            setPressed(false)
            setCycle((c) => c + 1)
            pressTimer = setTimeout(() => setPressed(true), 2200)
          }, CYCLE)
        } else {
          setPressed(false)
        }
      },
      { threshold: 0.2 }
    )
    if (ref.current) io.observe(ref.current)
    return () => {
      io.disconnect()
      clearInterval(timer)
      clearTimeout(pressTimer)
    }
  }, [])

  return (
    <div className="hero-demo" ref={ref} aria-hidden="true">
      <div className="hero-demo-bar">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span style={{ marginLeft: 8 }}>prod · history</span>
      </div>
      <div className="hero-demo-body">
        <div className="hero-diff">
          <div className="diff-row">
            <span className="badge badge-updated">updated</span>
            <span>STRIPE_KEY</span>
          </div>
          <div className="diff-row">
            <span className="diff-old">••••••••</span>
            <span style={{ color: 'var(--text-dim)' }}>→</span>
            <span className="diff-new">••••••••</span>
          </div>
          <div className="diff-row" style={{ marginTop: 8 }}>
            <span className="badge badge-added">added</span>
            <span>LOG_LEVEL</span>
          </div>
          <div className="diff-row">
            <span className="diff-new">••••••••</span>
          </div>
        </div>
        <div className="hero-commits">
          <h4>Versions</h4>
          {COMMITS.map((c, i) => (
            <div
              key={`${cycle}-${c.v}`}
              className={`hero-commit${i === 0 ? (pressed ? ' show' : '') : ' show'}`}
              style={i === 0 && !pressed ? { display: 'none' } : undefined}
            >
              <span className="v">{c.v}</span>
              <span className="m">
                {c.msg} · {c.who}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="hero-rollback">
        <span className="lbl">Someone pushed a bad value to prod.</span>
        <button
          type="button"
          className="btn btn-sm"
          tabIndex={-1}
          style={pressed ? { transform: 'scale(0.96)' } : undefined}
        >
          Rollback to v14
        </button>
      </div>
    </div>
  )
}
