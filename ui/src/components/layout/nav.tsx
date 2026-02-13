'use client';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';

export function Nav() {
  const { theme, setTheme } = useTheme();
  return <header className='border-b border-border'><div className='container-shell flex h-16 items-center justify-between'><div className='font-serif text-3xl'>AGIJobManager</div><nav className='flex gap-4 text-sm'><Link href='/'>Dashboard</Link><Link href='/jobs'>Jobs</Link><Link href='/admin'>Admin</Link><Link href='/design'>Design</Link><Link href='/demo'>Demo</Link></nav><div className='flex items-center gap-2'><Button variant='outline' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Theme</Button><ConnectButton showBalance={false} /></div></div></header>;
}
