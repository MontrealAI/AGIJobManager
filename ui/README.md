# AGIJobManager UI

Standalone Next.js App Router dapp + ops console for AGIJobManager.

## Setup

1. Copy env file and configure values:
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies:
   ```bash
   npm ci
   ```

## Commands

```bash
npm run dev
npm run build
npm run test
npm run test:e2e
npm run lint
```

## Notes
- Read-only mode works without wallet.
- Wallet write paths use simulation-first UX.
- If server RPC URLs are missing, UI falls back to public RPC and displays a degraded RPC banner.
