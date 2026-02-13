'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ThemeToggle } from './theme-toggle'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="font-medium">Dashboard</Link>
            <Link href="/jobs">Jobs</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ConnectButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-8">{children}</main>
    </div>
  )
}
