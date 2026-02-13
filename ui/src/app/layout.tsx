import { Inter, Source_Serif_4 } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/layout/nav';
import { Footer } from '@/components/layout/footer';

const inter = Inter({ subsets:['latin'], variable:'--font-inter' });
const serif = Source_Serif_4({ subsets:['latin'], variable:'--font-serif' });

export const metadata = { title: 'AGIJobManager' };

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang='en' suppressHydrationWarning><body className={`${inter.variable} ${serif.variable}`}><Providers><Nav/><main className='hero-aura min-h-[calc(100vh-8rem)]'>{children}</main><Footer/></Providers></body></html>;
}
