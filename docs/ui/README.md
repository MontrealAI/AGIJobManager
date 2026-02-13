# AGIJobManager UI Documentation

Institutional, read-first **dApp + ops console** docs for the standalone `ui/` Next.js app.

## Quick links
- [Overview](./OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Job Lifecycle](./JOB_LIFECYCLE.md)
- [Ops Runbook](./OPS_RUNBOOK.md)
- [Security Model](./SECURITY_MODEL.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Demo Mode](./DEMO.md)
- [Testing](./TESTING.md)
- [Versions](./VERSIONS.md)

## Run locally
```bash
cd ui
npm ci
npm run dev
```

## Demo mode
```bash
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Security posture
- Read-only-first rendering (wallet optional).
- Simulation-first writes and decoded custom errors.
- URI allowlist + copy-first untrusted string handling.
- Security headers + degraded RPC visibility.

## No-binaries policy
UI documentation demos are text-only artifacts: Markdown, Mermaid, JSON fixtures, and SVG. Binary file additions are blocked by CI.
