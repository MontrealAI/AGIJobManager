'use client'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    const isLight = document.documentElement.classList.contains('light')
    setTheme(isLight ? 'light' : 'dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('light', next === 'light')
    window.localStorage.setItem('theme', next)
  }

  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur">
      <div className="container flex items-center justify-between py-4">
        <nav className="flex gap-5 text-sm">
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        <div className="flex items-center gap-3">
          <button className="btn-secondary p-2" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <ConnectButton showBalance={false} />
        </div>
      </div>
    </header>
  )
}
