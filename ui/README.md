# AGIJobManager UI

Standalone Next.js App Router frontend for institutional dApp + sovereign ops workflows.

## Quick start

```bash
npm ci
cp .env.example .env.local
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Required verification commands

```bash
npm run check:no-binaries
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run test:headers
npm run docs:versions
npm run docs:contract
npm run docs:check
npm run build
```

## Notes

- Read-only mode works without wallet connectivity.
- Write actions are simulation-first and can be fully demonstrated in deterministic demo mode.
- WalletConnect remains optional; the UI gracefully degrades when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is not configured.
