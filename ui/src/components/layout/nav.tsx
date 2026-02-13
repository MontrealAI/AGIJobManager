'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';

export function Nav() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="border-b border-border">
      <div className="container flex h-16 items-center justify-between">
        <div className="font-serif text-3xl">AGIJobManager</div>
        <nav className="flex gap-4 text-sm">
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/design">Design</Link>
          <Link href="/demo">Demo</Link>
        </nav>
        <button className="border border-border rounded-md px-3 py-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Theme</button>
      </div>
    </header>
  );
}
