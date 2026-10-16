import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  title: 'Env Time Machine',
  description: 'Git history for your env vars. Every change diffed, attributed, one click away from rollback.',
}

// Bare root shell. The (app) group adds the sidebar chrome; the
// (marketing) group renders standalone pages with no app chrome.
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
