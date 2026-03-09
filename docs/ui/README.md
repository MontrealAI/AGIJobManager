# AGIJobManager UI / Sovereign Ops Console

Institutional-grade Next.js dApp + operations console with **read-only first**, **simulation-first writes**, and deterministic demo mode.

> Also see the standalone, versioned browser artifact documentation for `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`: [STANDALONE_GENESIS_JOB_MAINNET_HTML_UI.md](./STANDALONE_GENESIS_JOB_MAINNET_HTML_UI.md).

## Quick links
- [Standalone HTML artifact (genesis mainnet v21)](./STANDALONE_GENESIS_JOB_MAINNET_HTML_UI.md)
- [Overview](./OVERVIEW.md)
- [Architecture](./ARCHITECTURE.md)
- [Job Lifecycle](./JOB_LIFECYCLE.md)
- [Identity Layer](./IDENTITY_LAYER.md)
- [Ops Runbook](./OPS_RUNBOOK.md)
- [Security Model](./SECURITY_MODEL.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Demo Mode](./DEMO.md)
- [Testing & CI](./TESTING.md)
- [Versions](./VERSIONS.md)
- [Contract Interface](./CONTRACT_INTERFACE.md)
- [Mainnet Deployment Registry](./DEPLOYMENT_MAINNET.md)

## Run locally
```bash
cd ui
npm ci
npm run dev
```

## Demo mode

`.env.example` is prefilled with the official `v0.1.0-mainnet-beta` Ethereum mainnet deployment defaults.
```bash
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Security posture
- Wallet optional for read-only workflows.
- Every write path uses preflight checks + `simulateContract()`.
- Untrusted URIs are sanitized with an explicit scheme allowlist.
- Strict security headers and CSP are enforced for all routes.

## Documentation policy
This folder is **text-only**. Binary assets are forbidden and CI-enforced by `npm run check:no-binaries` in local checks and CI.


## Deployment references

- [IPFS single-file deployment](./IPFS_DEPLOYMENT.md)
- [GitHub Pages autopublish](./GITHUB_PAGES.md)
