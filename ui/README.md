# AGIJobManager UI

Standalone Next.js App Router dapp + ops console.

## Setup

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Notes
- Read-only mode works without wallet.
- If server RPC URLs are not configured, app falls back to public RPC and shows degraded mode.
- `/api/merkle` returns 501 unless proof backend is configured.
