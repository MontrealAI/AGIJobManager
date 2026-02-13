# AGIJobManager UI

Next.js + TypeScript App Router dapp and ops console for `AGIJobManager`.

## Requirements

- Node `>=20.11.0`

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Commands

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Implemented pages

- `/` Dashboard with network/pause/degraded banners and sovereign hero.
- `/jobs` read-only browse with multicall and filtering.
- `/jobs/[jobId]` job status, deadlines, timeline, URI safety controls, role actions and token approvals.
- `/admin` owner-gated ops console with typed confirmations.

## Security highlights

- Simulation-first writes with decoded custom errors.
- URI scheme allowlist (`https`, `http`, `ipfs`, `ens`) and disabled unsafe links.
- Strict response headers via `next.config.js` (CSP + frame hardening + policy headers).
