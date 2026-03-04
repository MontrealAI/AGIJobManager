'use client';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';

const HASH_NAV_ROUTES = [
  { label: 'Dashboard', href: '#/' },
  { label: 'Jobs', href: '#/jobs' },
  { label: 'Identity', href: '#/identity' },
  { label: 'Admin', href: '#/admin' },
  { label: 'Advanced', href: '#/advanced' },
  { label: 'Design', href: '#/design' },
  { label: 'Deployment', href: '#/deployment' },
  { label: 'Demo', href: '#/demo' },
];

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
          {HASH_NAV_ROUTES.map((route) => (
            <a key={route.href} href={route.href} data-testid={`top-nav-${route.label.toLowerCase()}`}>
              {route.label}
            </a>
          ))}
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
