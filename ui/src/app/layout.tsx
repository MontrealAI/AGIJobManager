import './globals.css'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/layout/app-shell'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable}`}>
        <Providers mainnetRpc={process.env.RPC_MAINNET_URL} sepoliaRpc={process.env.RPC_SEPOLIA_URL}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
