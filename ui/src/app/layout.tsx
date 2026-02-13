import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/layout/nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = { title: 'AGIJobManager UI', description: 'Institutional sovereign ops console for AGIJobManager.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang='en' suppressHydrationWarning><body><Providers><Nav /><main className='hero-aura min-h-[calc(100vh-8rem)]'>{children}</main><Footer /></Providers></body></html>;
}
