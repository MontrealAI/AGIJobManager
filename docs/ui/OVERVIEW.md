# AGIJobManager UI / Ops Console Overview

The `ui/` app is a standalone Next.js App Router interface for institutional operators, employers, agents, validators, and auditors.

## Posture
- Read-only first: dashboard, jobs, and detail pages work without a wallet.
- Wallet mode: write actions are role-gated and simulation-first.
- Demo Mode (`NEXT_PUBLIC_DEMO_MODE=1`): deterministic fixtures for testing, demos, and CI.

## Screenshot Gallery
![Dashboard](./screenshots/dashboard.svg)
![Jobs](./screenshots/jobs.svg)
![Job detail](./screenshots/job-detail.svg)
![Admin](./screenshots/admin.svg)
