import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@/styles/globals.css';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/layout/nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = { title: 'AGIJobManager UI', description: 'Institutional sovereign ops console for AGIJobManager.' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Request headers keep pages dynamic so every response receives a fresh nonce.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return <html lang='en' className='dark' suppressHydrationWarning><body><Providers nonce={nonce}><Nav /><main className='hero-aura min-h-[calc(100vh-8rem)]'>{children}</main><Footer /></Providers></body></html>;
}
