'use client'

import { useEffect, useState } from 'react'

// Sticky blur nav; the hairline border appears on scroll.
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="landing-inner">
        <a className="landing-wordmark" href="/landing">
          <span className="mark" />
          env time machine
        </a>
        <nav className="landing-links">
          <a href="#how">How it works</a>
          <a href="#security">Security</a>
          <a href="/pricing">Pricing</a>
        </nav>
        <span className="spacer" />
        <a className="btn btn-ghost btn-sm" href="/login">
          Sign in
        </a>
        <a className="btn btn-sm" href="/signup">
          Get started
        </a>
      </div>
    </header>
  )
}
