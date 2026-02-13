import '../styles/globals.css'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { ClientShell } from '@/components/client-shell'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const rpcMainnetUrl = process.env.RPC_MAINNET_URL || ''
  const rpcSepoliaUrl = process.env.RPC_SEPOLIA_URL || ''
  const degradedRpc = !rpcMainnetUrl && !rpcSepoliaUrl

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <ClientShell rpcMainnetUrl={rpcMainnetUrl} rpcSepoliaUrl={rpcSepoliaUrl} degradedRpc={degradedRpc}>{children}</ClientShell>
      </body>
    </html>
  )
}
