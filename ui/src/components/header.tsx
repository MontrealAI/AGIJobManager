'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Header({ isDark, onToggleTheme, degradedRpc }: { isDark: boolean; onToggleTheme: () => void; degradedRpc: boolean }) {
  return (
    <header className="border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="container-shell flex items-center justify-between py-5">
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="font-medium">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Ops Console</Link>
          {degradedRpc && <span className="pill border-yellow-500/50 text-yellow-400">Degraded RPC</span>}
        </nav>
        <div className="flex items-center gap-3">
          <button className="btn-outline" onClick={onToggleTheme}>{isDark ? 'Light' : 'Dark'} mode</button>
          <ConnectButton showBalance={false} />
        </div>
      </div>
    </header>
  )
}
