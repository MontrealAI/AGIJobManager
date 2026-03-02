'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';
import { Button } from '../ui/button';

const HASH_ROUTING = process.env.NEXT_PUBLIC_HASH_ROUTING === '1';

function RouteLink({ href, children }: { href: string; children: ReactNode }) {
  if (HASH_ROUTING) {
    return <a href={`#${href}`}>{children}</a>;
  }

  return <Link href={href}>{children}</Link>;
}

export function Nav() {
  const { theme, setTheme } = useTheme();
  const [isFileProtocol, setIsFileProtocol] = useState(false);

  useEffect(() => {
    setIsFileProtocol(window.location.protocol === 'file:');
  }, []);

  return (
    <header className="border-b border-border">
      <div className="container-shell flex h-16 items-center justify-between">
        <div className="font-serif text-3xl">AGIJobManager</div>
        <nav className="flex gap-4 text-sm">
          <RouteLink href='/'>Dashboard</RouteLink><RouteLink href='/jobs'>Jobs</RouteLink><RouteLink href='/identity'>Identity</RouteLink><RouteLink href='/admin'>Admin</RouteLink><RouteLink href='/advanced'>Advanced</RouteLink><RouteLink href='/design'>Design</RouteLink><RouteLink href='/deployment'>Deployment</RouteLink><RouteLink href='/demo'>Demo</RouteLink>
        </nav>
        <div className='flex items-center gap-2'><Button variant='outline' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Theme</Button><ConnectButton showBalance={false} /></div>
      </div>
      {isFileProtocol && (
        <div className="border-t border-amber-500/40 bg-amber-500/10 py-2 text-xs text-amber-200" data-testid="file-protocol-warning">
          <div className="container-shell">
            file:// origin detected. Wallet injection typically requires HTTPS. Use GitHub Pages or an IPFS gateway for wallet write flows.
          </div>
        </div>
      )}
    </header>
  );
}
