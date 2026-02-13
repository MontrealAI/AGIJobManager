'use client';
import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function Nav() {
  return (
    <header className="border-b border-border/40">
      <nav className="container h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl">AGIJobManager</Link>
        <div className="flex gap-4 text-sm">
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/design">Design</Link>
          <Link href="/demo">Demo</Link>
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}
