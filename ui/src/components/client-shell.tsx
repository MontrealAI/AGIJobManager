'use client'
import Providers from '@/components/providers'
import { Header } from '@/components/header'

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Header />
      <main className="container py-6">{children}</main>
    </Providers>
  )
}
