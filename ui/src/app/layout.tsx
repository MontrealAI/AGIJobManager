import './globals.css'
import dynamic from 'next/dynamic'
import { Inter, Source_Serif_4 } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })
const ClientShell = dynamic(() => import('@/components/client-shell').then((m) => m.ClientShell), { ssr: false })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
