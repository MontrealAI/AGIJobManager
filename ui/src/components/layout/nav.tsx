'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ThemeToggle } from './theme-toggle'

export function Nav() {
  return (
    <header className="border-b border-border/80">
      <div className="container-shell flex h-16 items-center justify-between">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-semibold">AGIJobManager</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        <div className="flex items-center gap-2"><ThemeToggle /><ConnectButton showBalance={false} /></div>
      </div>
    </header>
  )
}
