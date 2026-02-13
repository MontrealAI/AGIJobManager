# AGIJobManager UI Docs Index

Institutional-grade **dApp + Sovereign Ops Console** documentation for the `ui/` Next.js app.

## Quick links
- [Overview](./OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Job lifecycle](./JOB_LIFECYCLE.md)
- [Ops runbook](./OPS_RUNBOOK.md)
- [Security model](./SECURITY_MODEL.md)
- [Design system](./DESIGN_SYSTEM.md)
- [Demo mode](./DEMO.md)
- [Testing & CI](./TESTING.md)
- [Versions snapshot](./VERSIONS.md)

## Run locally
```bash
cd ui
npm ci
npm run dev
```

## Demo mode
```bash
cd ui
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Security posture (summary)
- Read-only works without wallet.
- All write flows are simulation-first.
- URI rendering is allowlisted and copy-first.
- Security headers are enforced and tested.

## No-binaries policy
UI docs and demonstration assets are text-only (`.md`, Mermaid, `.svg`, JSON, source code). Forbidden binary extensions are blocked by CI.
