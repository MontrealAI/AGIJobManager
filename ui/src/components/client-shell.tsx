'use client'

import Providers from '@/components/providers'
import { Nav } from '@/components/layout/nav'
import { Footer } from '@/components/layout/footer'
import { GlobalBanners } from '@/components/banners'

export function ClientShell({ children, rpcMainnetUrl, rpcSepoliaUrl, degradedRpc }: { children: React.ReactNode; rpcMainnetUrl?: string; rpcSepoliaUrl?: string; degradedRpc?: boolean }) {
  return (
    <Providers rpcMainnetUrl={rpcMainnetUrl} rpcSepoliaUrl={rpcSepoliaUrl}>
      <Nav />
      <main className="container-shell py-8">
        <GlobalBanners degradedRpc={degradedRpc} />
        {children}
      </main>
      <Footer />
    </Providers>
  )
}
