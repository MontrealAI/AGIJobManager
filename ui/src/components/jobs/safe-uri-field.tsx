'use client'

import { useMemo } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { isSafeUri } from '@/lib/security'

export function SafeUriField({ label, uri }: { label: string; uri: string }) {
  const normalized = useMemo(() => uri?.trim() || '', [uri])
  const canOpen = isSafeUri(normalized)

  async function copyUri() {
    if (!normalized) return
    try {
      await navigator.clipboard.writeText(normalized)
    } catch {
      // no-op: copying is best effort only
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="break-all rounded-md border border-border bg-muted/30 p-2 text-xs tabular-nums">{normalized || '—'}</p>
      <div className="flex gap-2">
        <button type="button" className="btn-outline inline-flex items-center gap-2" onClick={copyUri} disabled={!normalized}>
          <Copy className="h-4 w-4" /> Copy
        </button>
        <a
          className={`btn-outline inline-flex items-center gap-2 ${!canOpen ? 'pointer-events-none opacity-40' : ''}`}
          href={canOpen ? normalized : undefined}
          target="_blank"
          rel="noreferrer noopener"
          aria-disabled={!canOpen}
        >
          <ExternalLink className="h-4 w-4" /> Open link
        </a>
      </div>
    </div>
  )
}
