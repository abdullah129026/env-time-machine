import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  title: 'Env Time Machine',
  description: 'Git history for your env vars. Every change diffed, attributed, one click away from rollback.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <a className="brand" href="/">env<span>time</span></a>
            <nav>
              <a className="nav-link" href="/">Projects</a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  )
}
