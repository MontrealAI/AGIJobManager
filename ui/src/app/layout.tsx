import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/providers';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = { title: 'AGIJobManager Ops Console' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${serif.variable} min-h-screen`}>
        <Providers>
          <div className="mx-auto max-w-6xl px-6 py-6">
            <header className="mb-8 flex items-center justify-between">
              <nav className="flex gap-4 text-sm">
                <Link href="/">Dashboard</Link>
                <Link href="/jobs">Jobs</Link>
                <Link href="/admin">Admin</Link>
              </nav>
              <ThemeToggle />
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
