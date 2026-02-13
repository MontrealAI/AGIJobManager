import './globals.css'
import dynamic from 'next/dynamic'

const ClientShell = dynamic(() => import('@/components/client-shell').then((m) => m.ClientShell), { ssr: false })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
