# AGIJobManager

[![CI][ci-badge]][ci-url]
[![Security Verification][security-verification-badge]][security-verification-url]
[![Docs][docs-badge]][docs-url]
[![Security Policy][security-badge]][security-url]
[![License][license-badge]][license-url]

AGIJobManager is an Ethereum smart-contract system for escrowed AGI work agreements, with optional ENS-backed job pages managed by `ENSJobPages`.

> **Operational policy:** intended for autonomous AI-agent execution with accountable human owner/operator oversight. This is policy intent and is not fully enforced on-chain.

## Start here by role (30-second routing)

- **New operator / deployer:** start with [`hardhat/README.md`](hardhat/README.md) (**official path**) and then the deployment index [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md).
- **Contract owner (Etherscan-first):** start with [`docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md`](docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md), then [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md).
- **ENSJobPages replacement operator:** use one canonical flow in [`docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).
- **Troubleshooting during deployment/cutover:** go to [`docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`](docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md).
- **Standalone HTML UI operator/reviewer:** start with [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md), then [`docs/ui/STANDALONE_HTML_UIS.md`](docs/ui/STANDALONE_HTML_UIS.md) and [`ui/README.md`](ui/README.md) for UI surface inventory.
- **Broader/full UI contributor:** use [`docs/ui/README.md`](docs/ui/README.md) for Next.js UI roadmap, runbooks, and release/testing docs.

## Canonical operator answers (quick reference)

- **Canonical deployment path:** Hardhat (`hardhat/README.md`). Truffle is legacy/supported.
- **Canonical ENS replacement flow:** deploy new ENSJobPages -> NameWrapper approval -> `setEnsJobPages` -> legacy migration if needed -> lock only after validation.
- **Canonical ENS naming format:** `<prefix><jobId>.<jobsRootName>` with default prefix `agijob`.
- **Canonical ownership split:**
  - `AGIJobManager owner` controls `setEnsJobPages(...)` and AGIJobManager governance.
  - `wrapped-root owner` controls NameWrapper approval needed for wrapped-root ENS writes.
- **Canonical safety rule:** ENS hooks are best-effort side effects; settlement/dispute outcomes remain authoritative on AGIJobManager.

### Manual vs automated (do not assume)

| Action | Automated by deploy scripts | Manual caller |
| --- | --- | --- |
| Deploy `AGIJobManager` / deploy new `ENSJobPages` | Yes | deployer key |
| NameWrapper approval `setApprovalForAll(newEnsJobPages, true)` | No | wrapped-root owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No | AGIJobManager owner |
| Legacy migration `migrateLegacyWrappedJobPage(jobId, exactLabel)` | No | ENSJobPages owner (if needed) |
| `lockConfiguration()` / `lockIdentityConfiguration()` | No | owner(s), only after validation |

## Most common owner/operator safety checks

Before any irreversible action:
- Confirm which key is **AGIJobManager owner** vs **wrapped-root owner**.
- Confirm manual steps are complete: `setApprovalForAll(newEnsJobPages, true)` then `setEnsJobPages(newEnsJobPages)`.
- Confirm at least one future job hook succeeds and legacy migration status is known.

Irreversible actions (delay until validated):
- `AGIJobManager.lockIdentityConfiguration()`
- `ENSJobPages.lockConfiguration()`

## What this repository contains

### UI surfaces (what exists now)

- **Smart contracts (authoritative protocol state):** `contracts/` (AGIJobManager + ENSJobPages integration).
- **Deployment/operator tooling (official):** `hardhat/` with runbooks in `docs/DEPLOYMENT/`.
- **ENS identity layer (additive):** ENSJobPages docs in `docs/ENS/` and replacement flow in `docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`.
- **Standalone HTML UI artifact (versioned):** `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` with operator guide at [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md) and artifact index [`docs/ui/STANDALONE_HTML_UIS.md`](docs/ui/STANDALONE_HTML_UIS.md).
- **Broader/full UI in development:** Next.js app and UI docs in [`ui/`](ui/) and [`docs/ui/README.md`](docs/ui/README.md).

### UI routing (pick the right interface quickly)

| If you need to... | Use this | Why |
| --- | --- | --- |
| Operate a versioned single-file mainnet interface | [`ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`](ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html) + [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md) | Fast, standalone browser artifact for direct operator/reviewer workflows. |
| Build/test the broader UI stack | [`ui/`](ui/) + [`docs/ui/README.md`](docs/ui/README.md) | Full Next.js UI effort, still in active development. |
| Deploy/replace contracts and ENS components | [`hardhat/README.md`](hardhat/README.md) + [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md) | Canonical deployment and operator runbooks; UI is not a deployment substitute. |

> **UI safety boundary:** the standalone HTML artifact is action-capable, but contract deployment, ownership wiring, and ENS replacement authority remain in Hardhat/deployment runbooks.

### Core contracts
- `contracts/AGIJobManager.sol`: core escrow, role checks, job lifecycle, settlement, dispute flow, owner controls.
- `contracts/ens/ENSJobPages.sol`: optional ENS per-job page manager, naming, resolver updates, permission hooks, and legacy wrapped-page migration.
- `contracts/utils/*.sol`: linked libraries used by `AGIJobManager` in official Hardhat deployment.

### Deployment tooling
- `hardhat/`: **official/recommended** deployment and Etherscan verification flow.
- Root Truffle config + migration scripts: **legacy/supported** deployment flow for backward compatibility and reproducibility.

### Documentation entry points
- Canonical deployment index: [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md)
- Official Hardhat operator guide: [`hardhat/README.md`](hardhat/README.md)
- ENSJobPages replacement runbook (mainnet): [`docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- ENS naming/behavior reference: [`docs/ENS/ENS_JOB_PAGES_OVERVIEW.md`](docs/ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Deployment troubleshooting: [`docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`](docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
- Standalone HTML UI (v21) operator guide: [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- UI directory inventory: [`ui/README.md`](ui/README.md)

## Recommended vs legacy deployment paths

### Recommended (official): Hardhat
Use Hardhat for production deployment and verification of `AGIJobManager`, and for additive `ENSJobPages` deployment/replacement.

Start here: [`hardhat/README.md`](hardhat/README.md)

### Legacy (supported): Truffle
Truffle remains available for historical reproducibility and existing operational environments.

Legacy docs:
- [`docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md`](docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
- [`docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md`](docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md)
- [`docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md`](docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md)

## ENSJobPages in one minute

- `AGIJobManager` provides the numeric `jobId`.
- `ENSJobPages` provides the label prefix (`jobLabelPrefix`, default `agijob`) and root suffix (`jobsRootName`, e.g. `alpha.jobs.agi.eth`).
- Effective ENS name format is: `<prefix><jobId>.<jobsRootName>`.
- With current defaults, names are:
  - `agijob0.alpha.jobs.agi.eth`
  - `agijob1.alpha.jobs.agi.eth`
- Prefix updates only affect jobs whose labels are not yet snapshotted.
- ENS hooks are best-effort and non-fatal to core settlement; protocol settlement can succeed even when ENS writes fail.

See full behavior details: [`docs/ENS/ENS_JOB_PAGES_OVERVIEW.md`](docs/ENS/ENS_JOB_PAGES_OVERVIEW.md)

## Operator quickstart

1. Read the official Hardhat guide and prepare `.env` + deploy config.
2. From `hardhat/`, compile (`cd hardhat && npx hardhat compile`) and dry-run (`DRY_RUN=1 ...`).
3. Deploy `AGIJobManager` with mainnet confirmation gate.
4. If replacing ENS pages, deploy `ENSJobPages` via `hardhat/scripts/deploy-ens-job-pages.js`.
5. Perform manual post-deploy wiring on mainnet:
   - `NameWrapper.setApprovalForAll(newEnsJobPages, true)` by wrapped-root owner.
   - `AGIJobManager.setEnsJobPages(newEnsJobPages)` by AGIJobManager owner.
6. If legacy jobs must retain historical labels, run per-job migration (`migrateLegacyWrappedJobPage(jobId, exactLabel)`).
7. Verify results on Etherscan using `Read Contract` + events.
8. Only lock configuration after validation is complete.

Expected result after safe cutover:
- New jobs use `<prefix><jobId>.<jobsRootName>` (default `agijob...alpha.jobs.agi.eth`).
- AGIJobManager lifecycle and settlement continue even if an ENS side-effect fails.
- Legacy labels remain stable unless explicitly migrated/imported.

### Never-do-this-by-accident checklist

- Do **not** assume scripts perform NameWrapper approval or `setEnsJobPages(...)`; those remain manual.
- Do **not** call `lockConfiguration()` / `lockIdentityConfiguration()` before deploy, wiring, and migration validation.
- Do **not** assume changing `jobLabelPrefix` rewrites existing legacy/snapshotted names.
- Do **not** treat ENS hook failures as settlement failures; check both protocol events and ENS hook events.

Detailed procedures and expected outputs:
- [`hardhat/README.md`](hardhat/README.md)
- [`docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)

## Local development checks

```bash
npm ci
npm run lint
npm run build
npm run size
npm test
npm run docs:check
npm run docs:ens:check
```

## Documentation

- Main documentation index: [`docs/README.md`](docs/README.md)
- UI docs hub (broader UI): [`docs/ui/README.md`](docs/ui/README.md)
- Standalone HTML UI guide (v21): [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- UI directory inventory: [`ui/README.md`](ui/README.md)
- Quintessential walkthrough: [`docs/QUINTESSENTIAL_USE_CASE.md`](docs/QUINTESSENTIAL_USE_CASE.md)

Maintenance commands:

```bash
npm run docs:gen
npm run docs:check
npm run check:no-binaries
```

Alias note: `check-no-binaries` is exposed as `npm run check:no-binaries`.

## Policy and legal references

- Intended use policy: [`docs/POLICY/AI_AGENTS_ONLY.md`](docs/POLICY/AI_AGENTS_ONLY.md)
- Terms & Conditions: [`docs/LEGAL/TERMS_AND_CONDITIONS.md`](docs/LEGAL/TERMS_AND_CONDITIONS.md)
- Security policy: [`SECURITY.md`](SECURITY.md)

[ci-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/ci.yml?branch=main&style=flat-square&label=CI
[ci-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml
[security-verification-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/security-verification.yml?branch=main&style=flat-square&label=Security%20Verification
[security-verification-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/security-verification.yml
[docs-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/docs.yml?branch=main&style=flat-square&label=Docs%20Integrity
[docs-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/docs.yml
[security-badge]: https://img.shields.io/badge/Security-Policy-blue?style=flat-square
[security-url]: ./SECURITY.md
[license-badge]: https://img.shields.io/github/license/MontrealAI/AGIJobManager?style=flat-square
[license-url]: ./LICENSE
