'use client'
import Link from 'next/link'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function Header() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  return (
    <header className="border-b border-slate-800">
      <div className="container flex items-center justify-between py-4">
        <nav className="flex gap-4">
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        {isConnected ? (
          <button className="btn" onClick={() => disconnect()}>{address?.slice(0, 6)}... Disconnect</button>
        ) : (
          <button className="btn" onClick={() => connectors[0] && connect({ connector: connectors[0] })}>Connect wallet</button>
        )}
      </div>
    </header>
  )
}
