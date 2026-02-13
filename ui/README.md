# AGIJobManager UI / Ops Console

## Quick start

```bash
npm ci
cp .env.example .env.local
npm run docs:generate
npm run dev
```

Demo mode is deterministic via `NEXT_PUBLIC_DEMO_MODE=1` and `?scenario=` query param.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run test:headers
npm run build
npm run docs:check
node scripts/check-contract-drift.mjs
node scripts/check-no-binary.mjs
```
