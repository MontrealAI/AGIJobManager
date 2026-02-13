'use client'

import Providers from '@/components/providers'
import { Header } from '@/components/header'
import { useEffect, useState } from 'react'

export function ClientShell({ children, rpcMainnetUrl, rpcSepoliaUrl, degradedRpc }: { children: React.ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string; degradedRpc: boolean }) {
  const [isDark, setDark] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem('theme')
    const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  const toggle = () => {
    const next = !isDark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <Providers rpcMainnetUrl={rpcMainnetUrl} rpcSepoliaUrl={rpcSepoliaUrl}>
      <Header isDark={isDark} onToggleTheme={toggle} degradedRpc={degradedRpc} />
      <main className="container-shell py-8">{children}</main>
    </Providers>
  )
}
