# AGIJobManager UI

This directory contains **two additive UI surfaces**:

1. A modern Next.js app (broader UI effort, still evolving).
2. Versioned standalone HTML artifacts for direct browser use, including:
   - `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

The standalone HTML page is **not** a replacement for the full UI roadmap.

## UI inventory (operator-friendly)

| File / path | Purpose | Network / environment | Intended audience | Status | Docs |
| --- | --- | --- | --- | --- | --- |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` | Standalone browser interface for the Genesis mainnet flow: wallet connect, role/readiness checks, live jobs table, create/apply/validate/dispute/finalize actions, completion submission, and $AGIALPHA bridge/conversion helpers. | Ethereum mainnet-focused (`chainId 1`) with embedded mainnet contract addresses. | Operators, contract-adjacent power users, demos/reviewers who need a single-file interface artifact. | Versioned standalone artifact (additive, active snapshot). | `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md` |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v13.html` ... `v20.html` | Earlier standalone snapshots for historical comparison and reproducibility. | Mainnet-oriented standalone snapshots. | Auditors/reviewers comparing versions. | Archived snapshots. | `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md` |
| `dist-ipfs/agijobmanager.html` | Built single-file artifact generated from the Next.js UI pipeline (IPFS/distribution output). | Environment depends on build-time config. | Release operators and distribution workflow maintainers. | Generated build output. | `../docs/ui/IPFS_DEPLOYMENT.md` |
| `package.json`, `next.config.*`, `tests/`, `e2e/`, `scripts/` | Full Next.js UI codebase, testing, and deterministic build/documentation tooling. | Local dev/demo + deployment pipelines. | UI developers/operators. | Broader/full UI in development. | `../docs/ui/README.md` |

## Quick start

### Use the standalone HTML artifact

Open the dedicated runbook first:
- `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`

### Run the broader Next.js UI locally

```bash
cd ui
npm ci
cp .env.example .env.local
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Required verification commands (Next.js UI workflow)

```bash
cd ui
npm run check:no-binaries
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:a11y
npm run test:security
npm run docs:versions
npm run docs:contract
npm run docs:check
npm run build:ipfs
npm run verify:ipfs
npm run verify:deterministic
npm run verify:committed-html
```

## Notes

- Read-only behavior is available before wallet connection.
- Write actions are still governed by deployed contracts and wallet signature prompts.
- WalletConnect is optional in the Next.js app; extension wallets are sufficient for many flows.
