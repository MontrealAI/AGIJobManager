# AGIJobManager UI / Sovereign Ops Console

Next.js dApp and operations console with **read-only first**, **simulation-first writes**, and deterministic demo mode.

USDC entry: [v1.6.1 standalone console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.6.1/agijobmanager-usdc.html) and current [repository console](../../ui/agijobmanager-usdc.html). The v1.6.1 console includes privacy reviews, explicit draft saving and credential-safe uploads. See [release versus current-source scope](../V1_RELEASE_SCOPE.md#published-download-versus-current-source) for the deployment-tooling changes included in v1.6.1. Voting requires the `getJobBonds` getter, absent from v0.9.5 and older managers. Read the [compatibility notes and earlier bond-quote limitation](../qualification/BUYER_ECONOMICS_FOLLOWUP.md). Verify checksums and configure a verified compatible v0.9.6/v0.9.7 or v1.0.x/v1.6.1 USDC manager; no live manager is supplied by default.

## Quick links
- [USDC standalone operator guide](./GENESIS_JOB_MAINNET_HTML_UI.md)
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

`.env.example` leaves the new USDC manager, owner, deployer and deployment block empty. It selects Ethereum mainnet and canonical USDC, which does not establish an actual deployment. Demo mode supplies synthetic data:
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

For the versioned current USDC console and matching `ui/agijobmanager-usdc.html` artifact, use:

- [GENESIS_JOB_MAINNET_HTML_UI.md](./GENESIS_JOB_MAINNET_HTML_UI.md)
- [STANDALONE_HTML_UIS.md](./STANDALONE_HTML_UIS.md)

The Pages `agijobmanagerv0.html` filename is a moving compatibility alias, not an immutable release or a default deployed manager. Historical console sources are linked in the artifact index. Participant ENS membership and its explicit owner-managed exceptions are separate from optional job-page metadata; see the [namespace guide](../namespace/AGI_ETH_NAMESPACE_ALPHA.md).
