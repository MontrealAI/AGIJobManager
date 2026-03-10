# AGIJobManager UI

This directory contains **two additive UI surfaces**:

1. A modern Next.js app (broader UI effort, still evolving).
2. Versioned standalone HTML artifacts for direct browser use, including:
   - `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

The standalone HTML page is **not** a replacement for the full UI roadmap.

For broader/full UI status, planning, and runbooks, start at `../docs/ui/README.md`.

For standalone HTML artifact routing and inventory, see `../docs/ui/STANDALONE_HTML_UIS.md`.

## 30-second routing

- Need a **single-file, versioned mainnet interface artifact** for review/operator workflows: use `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` and the runbook at `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`.
- Need to **develop/test the broader UI**: use the Next.js app in this folder and docs at `../docs/ui/README.md`.

## UI inventory (operator-friendly)

| File / path | Purpose | Network / environment | Intended audience | Status | Docs |
| --- | --- | --- | --- | --- | --- |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` | Standalone browser interface for the Genesis mainnet flow: wallet connect, role/readiness checks, live jobs table, create/apply/validate/dispute/finalize actions, completion submission, and $AGIALPHA bridge/conversion helpers. | Ethereum mainnet-focused (`chainId 1`) with embedded mainnet contract addresses. | Operators, contract-adjacent power users, demos/reviewers who need a single-file interface artifact. | Versioned standalone artifact (additive, active snapshot). | `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md` |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v13.html` ... `v20.html` | Adjacent standalone snapshots for historical comparison and reproducibility. | Mainnet-oriented standalone snapshots. | Auditors/reviewers comparing versions and behavior deltas. | Versioned historical/iterative snapshots (do not treat as canonical operator default unless explicitly chosen). | `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md` |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v22.html` and `v23.html` | Newer standalone snapshots adjacent to `v21`; useful for comparative review and iterative testing. | Mainnet-oriented standalone snapshots. | Auditors/reviewers and UI maintainers comparing revisions. | Additive snapshots (use intentionally; `v21` remains canonical in this repo runbook). | `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md` |
| `dist-ipfs/agijobmanager.html` | Built single-file artifact generated from the Next.js UI pipeline (IPFS/distribution output). | Environment depends on build-time config. | Release operators and distribution workflow maintainers. | Generated build output. | `../docs/ui/IPFS_DEPLOYMENT.md` |
| `package.json`, `next.config.*`, `tests/`, `e2e/`, `scripts/` | Full Next.js UI codebase, testing, and deterministic build/documentation tooling. | Local dev/demo + deployment pipelines. | UI developers/operators. | Broader/full UI in development. | `../docs/ui/README.md` |


## Canonical standalone artifact for this runbook

For operator instructions in this repository, `v21` is the explicit standalone artifact documented in:

- `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`
- `../docs/ui/STANDALONE_HTML_UIS.md`

Later snapshots (for example `v22`/`v23`) are retained in-repo as additive versions for comparison and iterative UI work; they do not change deployment/operator canon by themselves.

### Operator-safe usage boundary

- Use the standalone page for browser-based read/write interaction only.
- Use `../hardhat/README.md` + deployment runbooks for deployment and ENS replacement operations.
- If standalone artifact guidance and deployment docs ever differ, follow deployment/operator docs and on-chain behavior.

## Quick start

### Use the standalone HTML artifact

Open the dedicated runbook first:
- `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`

Recommended operator posture:
- Treat `v21` as a versioned mainnet snapshot with embedded addresses.
- Verify network + addresses in the runbook before signing wallet transactions.
- Use the broader Next.js UI docs for roadmap/development workflows.

Safety reminder:
- UI convenience does not change protocol authority; AGIJobManager and ENSJobPages contracts remain authoritative.

### Run the broader Next.js UI locally

```bash
cd ui
npm ci
cp .env.example .env.local
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

## Standalone artifact quick-open (copy/paste)

```bash
cd /workspace/AGIJobManager/ui
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html
```

Pre-sign trust check (recommended):
- Confirm network is Ethereum mainnet (`chainId 1`).
- Confirm contract addresses against `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`.
- Confirm you are intentionally using the standalone artifact (not the broader Next.js UI flow).

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

## Safety and scope notes

- The standalone HTML artifact is **action-capable** on mainnet when a wallet is connected and terms are accepted in-page.
- The standalone artifact can be opened directly from disk, but local HTTP serving is recommended for browser compatibility.
- Neither UI surface replaces deployment/operator runbooks; use `../hardhat/README.md` and deployment docs for canonical contract operations.
