'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/identity', label: 'Identity' },
  { href: '/admin', label: 'Admin' },
  { href: '/advanced', label: 'Advanced' },
  { href: '/design', label: 'Design' },
  { href: '/deployment', label: 'Deployment' },
  { href: '/demo', label: 'Demo' }
];

export function Nav() {
  const { theme, setTheme } = useTheme();

  return (
    <header className='border-b border-border'>
      <div className='container-shell flex h-16 items-center justify-between'>
        <div className='font-serif text-3xl'>AGIJobManager</div>
        <nav className='flex gap-4 text-sm'>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            Theme
          </Button>
          <ConnectButton showBalance={false} />
        </div>
      </div>
    </header>
  );
}
