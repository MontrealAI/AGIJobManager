'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { isDemoMode } from '@/lib/demo';

export function Nav() {
  const { theme, setTheme } = useTheme();
  return (
    <header className='border-b border-border/70 backdrop-blur'>
      <div className='container flex h-16 items-center justify-between'>
        <div className='font-serif text-xl'>AGIJobManager</div>
        <nav className='flex gap-4 text-sm'>
          <Link href='/'>Dashboard</Link>
          <Link href='/jobs'>Jobs</Link>
          <Link href='/admin'>Admin</Link>
          <Link href='/design'>Design</Link>
          <Link href='/demo'>Demo</Link>
        </nav>
        <div className='flex items-center gap-2'>
          {isDemoMode && <span className='text-xs text-muted-foreground'>Demo</span>}
          <Button variant='outline' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Theme</Button>
          <ConnectButton showBalance={false} chainStatus='icon' />
        </div>
      </div>
    </header>
  );
}
