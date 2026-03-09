# AGIJobManager UI / Sovereign Ops Console

Institutional-grade Next.js dApp + operations console with **read-only first**, **simulation-first writes**, and deterministic demo mode.

## Quick links
- [Standalone Genesis Mainnet HTML UI (`v21`)](./GENESIS_JOB_MAINNET_HTML_UI.md)
- [Standalone HTML artifact index (`ui/*.html`)](./STANDALONE_HTML_UIS.md)
- [UI directory inventory (`/ui`)](../../ui/README.md)
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

## Standalone HTML artifact (additive)

For the versioned, single-file mainnet page in `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`, use:

- [GENESIS_JOB_MAINNET_HTML_UI.md](./GENESIS_JOB_MAINNET_HTML_UI.md)
- [STANDALONE_HTML_UIS.md](./STANDALONE_HTML_UIS.md)

This artifact is additive to the broader/full Next.js UI effort and is documented separately to keep operator guidance explicit and safe.
