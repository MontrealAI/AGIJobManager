import './globals.css'
import { Inter, Source_Serif_4 } from 'next/font/google'
import dynamic from 'next/dynamic'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })

const ClientShell = dynamic(() => import('@/components/client-shell').then((m) => m.ClientShell), { ssr: false })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const rpcMainnetUrl = process.env.RPC_MAINNET_URL || ''
  const rpcSepoliaUrl = process.env.RPC_SEPOLIA_URL || ''
  const degradedRpc = !rpcMainnetUrl && !rpcSepoliaUrl

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <ClientShell rpcMainnetUrl={rpcMainnetUrl} rpcSepoliaUrl={rpcSepoliaUrl} degradedRpc={degradedRpc}>
          {children}
        </ClientShell>
      </body>
    </html>
  )
}
