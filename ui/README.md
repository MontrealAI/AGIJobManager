# AGIJobManager UI

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Deterministic demo mode

```bash
NEXT_PUBLIC_DEMO_MODE=1 npm run dev
```

Use `?scenario=baseline` or `?scenario=paused-degraded`.

## Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:headers`
- `npm run build`
- `npm run docs:check`
- `node scripts/check-contract-drift.mjs`
- `node scripts/check-no-binary.mjs`
