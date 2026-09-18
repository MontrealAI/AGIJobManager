# AGIJobManager — Buyer protection and resilient USDC settlement

**Version 1.0:** [release scope and compatibility](docs/V1_RELEASE_SCOPE.md), [participant start](docs/START_HERE.md), and [launch checklist](docs/LAUNCH_CHECKLIST.md).

**Release: [v1.0.5](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.5).** Privacy safeguards, explicit user-data responsibilities and safer browser storage support independent operators. **NFT eligibility remains disabled by default and intake starts paused.** Solidity behavior, ABI and creation/runtime bytecode are unchanged from v1.0.3. Existing instances, jobs and agreements do not change on publication. See [legal notices](docs/LEGAL/README.md), the [launch checklist](docs/LAUNCH_CHECKLIST.md) and [compatibility](docs/qualification/OPERATIONS_V097.md).

**New in v1.0.5:** [user-data rules](docs/LEGAL/USER_DATA_RULES.md) prohibit added personal information, confidential material and secrets in public submissions and allocate users' own responsibilities to the maximum lawful extent. The console requires fresh public-content review, saves builder drafts only on request, keeps completion drafts in page memory, removes stored pinning credentials and restricts JWT uploads to Pinata over HTTPS. Read the [privacy notice](docs/LEGAL/PRIVACY.md), [storage guide](docs/privacy-and-storage.md) and [incident procedure](docs/OPERATIONS/PRIVACY_RESPONSE.md). Safeguards do not scan every submission, bind other clients or transfer statutory controller/processor duties. The [NFT policy](docs/NFT_POLICY.md), [configuration reference](docs/DEPLOYMENT_CONFIGURATION.md) and [deployment-specific ENS naming](docs/ENS_DEPLOYMENT_NAMESPACES.md) remain applicable. [Release scope](docs/V1_RELEASE_SCOPE.md#published-download-versus-current-source).

All job payments, escrow, bonds, rewards, refunds and treasury withdrawals use six-decimal native Circle USDC. **Moving from the original-asset legacy manager requires a fresh USDC deployment.** The v0.9.6/v1.0.5 manager uses eight fixed linked libraries, including `JobSettlement` and `JobValidation`. Incompatible older deployments need a fresh manager to gain the current features; existing USDC and original-asset jobs stay on their original contracts. This software release does not upgrade old contracts. Start with the [USDC migration and deployment guide](docs/USDC_MIGRATION.md).

**v1.0.5 protects full buyer escrow on a buyer win, removes automatic no-vote payments, requires the full review window, rejects duplicate/conflicted reviewers, freezes clocks during settlement pauses, and reserves failed outgoing payments for retry.** Buyers can explicitly accept satisfactory work; unanswered arbitration has a neutral refund deadline. [Read the simple buyer guide](docs/BUYER_PROTECTION.md). ENS membership and the per-job NFT policy remain in force. The [mainnet-fork rehearsal](docs/qualification/USDC_CUTOVER.md) covers USDC settlement, ownership, ENS wiring and preservation of existing jobs.

Successful jobs pay validators first (**8% default**), then **30% of the original job cost to wallet one**, **10% to wallet two**, and **all remaining USDC to the agent**. For a 100 USDC job: 8 / 30 / 10 / 52. The two wallet addresses are required at deployment. The owner can rotate them only with intake paused and zero outstanding escrow or bonds; [ownership transfers require acceptance](docs/OWNER_CONTROLS.md). The reward percentage is fixed when the job is posted; validator collateral is fixed at the first vote. NFT credentials affect eligibility only; they cannot increase or reduce the agent’s payment share. See the [v1.0.5 payout and migration specification](docs/USDC_PAYOUT_SPLIT.md).

AGI Agents normally qualify through a name under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators through `club.agi.eth` or `alpha.club.agi.eth`. The connected wallet must satisfy the configured name's NameWrapper ownership/approval or resolver-address check. Enter only the label, such as `alice`. The contract preserves owner-managed `additionalAgents`/`additionalValidators` and role-specific Merkle proofs as explicit membership exceptions; those routes are not proof of ENS membership. Agents also need a qualifying enabled NFT when the job’s posting-time NFT requirement is on. Fresh v1.0.5 managers start with that requirement disabled; owners can enable it for future jobs. These participant identity checks are separate from optional ENS job-page metadata.

**[Start here](docs/START_HERE.md)** for the download, the five-step job journey, role-specific guidance and recovery from a failed or pending transaction.

**[See the first artwork job under today's rules](docs/examples/GENESIS_JOB_TODAY.md):** a practical buyer/agent walkthrough, exact USDC economics, review timing, failure outcomes and a reproducible 24-scenario local simulation grounded in the historical Genesis receipt.

New deployments start with intake paused. v1.0.5 retains the contract and toolchain hardening introduced in v0.9.1 and the ENS correction introduced in v0.9.2. See [mainnet readiness](docs/MAINNET_READINESS.md) for verified scope and the steps required for an actual deployment.

[![CI][ci-badge]][ci-url]
[![Security Verification][security-verification-badge]][security-verification-url]
[![Docs][docs-badge]][docs-url]
[![Security Policy][security-badge]][security-url]
[![License][license-badge]][license-url]

AGIJobManager is an Ethereum smart-contract system for escrowed AGI work agreements, with optional ENS-backed job pages managed by `ENSJobPages`.

> [!IMPORTANT]
> **New here? Download the [v1.0.5 USDC Console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html).**
> This is the fastest operator/reviewer entry point for the standalone mainnet UI.  
> **Matching repository artifact:** `ui/agijobmanager-usdc.html`
> **Operator guide:** `docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`

## Quick links

- **Launch Genesis Console:** `https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html`
- **Read the operator guide:** `docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`
- **Inspect the pinned standalone artifact:** `ui/agijobmanager-usdc.html`
- **Deployment / contract operations:** `hardhat/README.md` and `docs/DEPLOYMENT/README.md`

> **Operational policy:** intended for autonomous AI-agent execution with accountable human owner/operator oversight. This is policy intent and is not fully enforced on-chain.

## Start here by role (30-second routing)

- **New operator / deployer:** start with [`hardhat/README.md`](hardhat/README.md) (**official path**) and then the deployment index [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md).
- **Contract owner (Etherscan-first):** start with [`docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md`](docs/DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md), then [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md).
- **ENSJobPages replacement operator:** use one canonical flow in [`docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).
- **Troubleshooting during deployment/cutover:** go to [`docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`](docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md).
- **Standalone HTML UI operator/reviewer:** start with the [Genesis Console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html), then read [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md). For the repo-pinned standalone artifact, see [`ui/agijobmanager-usdc.html`](ui/agijobmanager-usdc.html).
- **Broader/full UI contributor:** use [`docs/ui/README.md`](docs/ui/README.md) for Next.js UI roadmap, runbooks, and release/testing docs.

## Canonical operator answers (quick reference)

- **Canonical deployment path:** Hardhat (`hardhat/README.md`). Legacy snapshot migrations are retired.
- **Fresh USDC ENS cutover:** deploy a separate helper -> establish its ownership of a dedicated wrapped jobs-root token -> wire only the new manager and helper -> validate a full ENS lifecycle -> consider locks. Preserve the existing legacy manager, jobs, helper, root and approvals.
- **Same-manager helper replacement:** use the [replacement runbook](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md); any existing-page migration or broader NameWrapper authority needs separate review.
- **Canonical ENS naming format:** `job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth` for fresh scripted deployments; existing-manager replacements preserve their root and prefix. [Details](docs/ENS_DEPLOYMENT_NAMESPACES.md).
- **Canonical ownership split:**
  - `AGIJobManager owner` controls `setEnsJobPages(...)` and AGIJobManager governance.
  - `ENS parent owner` authorizes creation of the dedicated root; manager ownership alone grants no ENS parent authority.
  - `ENSJobPages owner` controls the helper independently; its ownership transfer takes effect in one step.
- **Canonical safety rule:** ENS hooks are best-effort side effects; settlement/dispute outcomes remain authoritative on AGIJobManager.

### Manual vs automated (do not assume)

| Action | Automated by deploy scripts | Manual caller |
| --- | --- | --- |
| Deploy `AGIJobManager` / deploy new `ENSJobPages` | Yes | deployer key |
| Create the dedicated root with the new helper as owner | No | ENS parent owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No | AGIJobManager owner |
| Existing-page migration for the same manager only | No | ENSJobPages owner (if reviewed and needed) |
| Manager `lockIdentityConfiguration()` | No | manager owner, only after validation |
| Helper `lockConfiguration()` | Optional via `LOCK_CONFIG=1`; leave `0` during deployment/wiring | helper owner, only after validation |

## Most common owner/operator safety checks

Before any irreversible action:
- Confirm the separate manager, helper and ENS parent owners and their actual signing paths.
- Confirm the dedicated root is owned by the new helper and both new manager/helper pointers are correct. A fresh USDC cutover does not require blanket approval over the legacy owner’s wrapped names.
- Confirm creation, delegated resolver writes and terminal revocation succeed without skipped or failed ENS hooks, and compare the preserved legacy inventory.

Irreversible actions (delay until validated):
- `AGIJobManager.lockIdentityConfiguration()`
- `ENSJobPages.lockConfiguration()`

## What this repository contains

### UI surfaces (what exists now)

- **Smart contracts (authoritative protocol state):** `contracts/` (AGIJobManager + ENSJobPages integration).
- **Deployment/operator tooling (official):** `hardhat/` with runbooks in `docs/DEPLOYMENT/`.
- **ENS identity layer (additive):** ENSJobPages docs in `docs/ENS/` and replacement flow in `docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`.
- **Standalone Genesis Console surfaces:** canonical newcomer entry is the versioned USDC Console (`https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html`); the current development standalone artifact is [`ui/agijobmanager-usdc.html`](ui/agijobmanager-usdc.html); the operator guide is [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md); artifact inventory and broader UI references remain in [`docs/ui/STANDALONE_HTML_UIS.md`](docs/ui/STANDALONE_HTML_UIS.md), [`ui/README.md`](ui/README.md), and [`docs/ui/README.md`](docs/ui/README.md).
- **Broader/full UI in development:** Next.js app and UI docs in [`ui/`](ui/) and [`docs/ui/README.md`](docs/ui/README.md).

### UI routing (pick the right interface quickly)

| If you need to... | Use this | Why |
| --- | --- | --- |
| Configure the versioned USDC interface after deployment | `https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html` + [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md) | Fastest newcomer/operator entry point for the standalone mainnet console. |
| Inspect the pinned standalone artifact in-repo | [`ui/agijobmanager-usdc.html`](ui/agijobmanager-usdc.html) | Development artifact for review; its voting flow requires the new getter. |
| Build/test the broader UI stack | [`ui/`](ui/) + [`docs/ui/README.md`](docs/ui/README.md) | Broader UI effort and development docs. |
| Deploy/replace contracts and ENS components | [`hardhat/README.md`](hardhat/README.md) + [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md) | Canonical deployment/operator runbooks; UI is not a deployment substitute. |

> **UI safety boundary:** the standalone HTML artifact is action-capable, but contract deployment, ownership wiring, and ENS replacement authority remain in Hardhat/deployment runbooks.

### Core contracts
- `contracts/AGIJobManager.sol`: core escrow, role checks, job lifecycle, settlement, dispute flow, owner controls.
- `contracts/ens/ENSJobPages.sol`: optional ENS per-job page manager, naming, resolver updates, permission hooks, and legacy wrapped-page migration.
- `contracts/utils/*.sol`: linked libraries used by `AGIJobManager` in official Hardhat deployment.

### Deployment tooling
- `hardhat/`: **official/recommended** deployment and Etherscan verification flow.
- Root contract tests: maintained Hardhat network and ethers compatibility helpers; Truffle/Ganache dependencies and historical migrations are retired.

### Deployment maintenance

The current [Hardhat guide](hardhat/README.md) now pairs a five-step deployment overview with read-only defaults for missing/empty `DRY_RUN`. The offline check reports the selected mode; broadcasting requires explicit `DRY_RUN=0` and the existing safety gates. Published v1.0.5 downloads are unchanged. Use a pinned source and its matching [release/maintenance scope](docs/V1_RELEASE_SCOPE.md#published-download-versus-current-source).

### Documentation entry points
- Canonical deployment index: [`docs/DEPLOYMENT/README.md`](docs/DEPLOYMENT/README.md)
- Official Hardhat operator guide: [`hardhat/README.md`](hardhat/README.md)
- ENSJobPages replacement runbook (mainnet): [`docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- ENS naming/behavior reference: [`docs/ENS/ENS_JOB_PAGES_OVERVIEW.md`](docs/ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Deployment troubleshooting: [`docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`](docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
- USDC Console (versioned download): `https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.5/agijobmanager-usdc.html`
- Genesis Console operator guide: [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- Pinned standalone artifact (repo): [`ui/agijobmanager-usdc.html`](ui/agijobmanager-usdc.html)
- UI directory inventory: [`ui/README.md`](ui/README.md)

## Recommended vs legacy deployment paths

### Recommended (official): Hardhat
Use Hardhat for production deployment and verification of `AGIJobManager`, and for additive `ENSJobPages` deployment/replacement.

Start here: [`hardhat/README.md`](hardhat/README.md)

### Retired: Truffle
Truffle and Ganache were removed in v0.9.1. `npm test` runs the preserved contract regression suites on a local Hardhat network. Use the Hardhat guide for public-network deployment; historical Truffle commands are unsupported.

Legacy docs:
- [`docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md`](docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
- [`docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md`](docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md)
- [`docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md`](docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md)

## ENSJobPages in one minute

- `AGIJobManager` provides the numeric `jobId`.
- `ENSJobPages` provides the label prefix (`jobLabelPrefix`: constructor default `agijob`, fresh deployment script sets `job-`) and root suffix (`jobsRootName`, explicitly configured for the new deployment).
- Effective ENS name format is: `<prefix><jobId>.<jobsRootName>`.
- With the fork-rehearsed proposal `usdc-v095.alpha.jobs.agi.eth`, names are:
  - `agijob0.usdc-v095.alpha.jobs.agi.eth`
  - `agijob1.usdc-v095.alpha.jobs.agi.eth`
- This namespace is a tested proposal, not a live deployment. The legacy `alpha.jobs.agi.eth` root remains in use by the original manager.
- Prefix updates only affect jobs whose labels are not yet snapshotted.
- ENS hooks are best-effort and non-fatal to core settlement; protocol settlement can succeed even when ENS writes fail.

See full behavior details: [`docs/ENS/ENS_JOB_PAGES_OVERVIEW.md`](docs/ENS/ENS_JOB_PAGES_OVERVIEW.md)

## Operator quickstart

1. Read the official Hardhat guide and prepare `.env` + deploy config.
2. From the repository root, run `cd hardhat`, then `npm run compile` and the documented `DRY_RUN=1` rehearsal.
3. Deploy `AGIJobManager` with mainnet confirmation gate.
4. Deploy the separate `ENSJobPages` with the explicitly reviewed `JOBS_ROOT_NAME` via the documented Hardhat command.
5. Have the ENS parent owner create the dedicated root with the new helper as its owner; the new manager owner then calls `setEnsJobPages(newEnsJobPages)`. Verify the helper also points to the new manager.
6. Preserve the old manager, original-token obligations, helper, namespace, approvals and existing jobs. Page migration is a separate same-manager replacement procedure, not the USDC cutover.
7. Verify source and results on Etherscan, complete two-step owner acceptance, and run the read-only deployment readiness checker while intake remains paused.
8. Only lock identity configuration after validation is complete. The accepted owner can then open intake and reconcile a deliberately limited first job.

Expected result after safe cutover:
- New jobs use `<prefix><jobId>.<jobsRootName>` under the reviewed dedicated USDC namespace.
- AGIJobManager lifecycle and settlement continue even if an ENS side-effect fails.
- Legacy jobs and labels remain on their original manager and helper.

### Never-do-this-by-accident checklist

- Do **not** assume scripts create the dedicated root or call `setEnsJobPages(...)`; those remain manual.
- Do **not** grant blanket NameWrapper approval or repoint legacy wiring as part of a fresh USDC cutover.
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
- Genesis Console operator guide: [`docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`](docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md)
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
