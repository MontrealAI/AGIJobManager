# AGIJobManager UI

Standalone Next.js App Router dapp + ops console for AGIJobManager.

## Setup

1. Copy env file and configure values:
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies exactly:
   ```bash
   npm ci
   ```

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Highlights

- Read-only mode works without wallet connection.
- Wallet writes use preflight and simulation-first `TxButton` interactions.
- Dark-default ASI Sovereign Purple theme with a user toggle.
- If server RPC URLs are missing, the UI falls back to public RPC endpoints and displays a degraded RPC banner.
