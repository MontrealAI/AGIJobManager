# AGIJobManager Documentation Hub

Institutional documentation for operators, integrators, contributors, and auditors.

## Start here in one minute

If you only read one thing right now:
- **Deploy or operate on mainnet (recommended):** [../hardhat/README.md](../hardhat/README.md)
- **Replace ENSJobPages safely:** [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- **Owner using Etherscan only:** [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)
- **Standalone HTML UI (versioned mainnet artifact):** [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- **Standalone HTML artifact index (`ui/*.html`):** [ui/STANDALONE_HTML_UIS.md](./ui/STANDALONE_HTML_UIS.md)
- **UI directory inventory (`ui/`):** [../ui/README.md](../ui/README.md)

## UI surfaces at a glance

| Surface | What it is now | Use this when | Canonical doc |
| --- | --- | --- | --- |
| Standalone HTML UI artifact | Versioned, single-file, mainnet-focused browser artifact (`v21`). | You need a direct operator/reviewer interface without running the full UI stack. | [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md) |
| Broader/full UI effort | Next.js UI with ongoing development, test, and release tracks. | You are developing, testing, or evaluating the full UI roadmap. | [ui/README.md](./ui/README.md) and [../ui/README.md](../ui/README.md) |



### UI task routing (fast path)

- **I need a single-file browser artifact for mainnet operations/review:** [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- **I need a safe pre-sign workflow for the standalone page:** use the checklist and troubleshooting sections in [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md).
- **I need to understand what exists in `ui/` (including older snapshots):** [../ui/README.md](../ui/README.md)
- **I need the broader/full UI roadmap and runbooks:** [ui/README.md](./ui/README.md)


## Standalone HTML UI safety routing

When you intentionally operate the single-file mainnet artifact (`v21`), use this order:

1. [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md) for preconditions, gate checks, and action flow.
2. [../ui/README.md](../ui/README.md) to confirm file inventory and artifact status in `ui/`.
3. [../hardhat/README.md](../hardhat/README.md) and [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) for deployment/cutover authority.

If guidance appears to conflict, follow deployment/operator runbooks and on-chain contract behavior.

**UI safety boundary:** standalone HTML is a client surface, not deployment authority; use Hardhat/deployment docs for owner/cutover decisions.

## Canonical docs (use these when docs overlap)

- **Canonical deployment workflow:** [../hardhat/README.md](../hardhat/README.md)
- **Canonical ENSJobPages replacement flow:** [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- **Canonical ENS naming/behavior reference:** [ENS/ENS_JOB_PAGES_OVERVIEW.md](./ENS/ENS_JOB_PAGES_OVERVIEW.md)
- **Canonical deployment/cutover troubleshooting:** [TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](./TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)

- **Canonical standalone HTML UI runbook:** [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- **Canonical broader UI docs hub:** [ui/README.md](./ui/README.md)
If another document conflicts with these in an operational detail, follow the canonical document and open a docs fix PR.


## Canonical ENS behavior (single source of truth)

- **Name format:** `<prefix><jobId>.<jobsRootName>`
- **Current defaults:** prefix `agijob` with names like `agijob0.alpha.jobs.agi.eth`, `agijob1.alpha.jobs.agi.eth`
- **Responsibility split:** AGIJobManager decides numeric `jobId`; ENSJobPages decides prefix/root + snapshotting + ENS writes
- **Cutover order:** deploy new ENSJobPages -> NameWrapper approval -> `setEnsJobPages` -> legacy migration (if needed) -> lock only after validation
- **Safety model:** ENS hooks are best-effort and non-fatal to settlement/dispute outcomes

## Start here if you are...

- **A new operator deploying now:** start with [../hardhat/README.md](../hardhat/README.md), then [DEPLOYMENT/README.md](./DEPLOYMENT/README.md).
- **An ENSJobPages replacement operator:** use [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) as the single canonical cutover flow.
- **A non-technical owner using Etherscan:** start with [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md), then [OWNER_RUNBOOK.md](./OWNER_RUNBOOK.md).
- **Troubleshooting ENS hook failures:** jump to [TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](./TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md).

## Audience map

| Audience | Start here | Then read |
| --- | --- | --- |
| New contributor | [QUICKSTART.md](./QUICKSTART.md) | [TESTING.md](./TESTING.md), [REPO_MAP.md](./REPO_MAP.md) |
| Protocol operator | [OVERVIEW.md](./OVERVIEW.md) | [DEPLOYMENT/README.md](./DEPLOYMENT/README.md), [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md), [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md) |
| Contract owner (non-technical) | [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) | [OWNER_RUNBOOK.md](./OWNER_RUNBOOK.md), [ETHERSCAN_GUIDE.md](./ETHERSCAN_GUIDE.md) |
| Security reviewer | [SECURITY_MODEL.md](./SECURITY_MODEL.md) | [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md), [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md) |
| Integrator | [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md) | [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md) |
| UI operator / reviewer | [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md) | [ui/README.md](./ui/README.md), [../ui/README.md](../ui/README.md) |

## Most common operator tasks

- Deploy AGIJobManager (Hardhat, recommended): [../hardhat/README.md](../hardhat/README.md)
- Deploy/replace ENSJobPages (additive flow): [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- Verify deployment on Etherscan (and check post-cutover events): [ETHERSCAN_GUIDE.md](./ETHERSCAN_GUIDE.md)
- Migrate legacy ENS job pages: [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md#8-legacy-migration-for-old-wrapped-job-pages](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md#8-legacy-migration-for-old-wrapped-job-pages)
- Perform mainnet owner cutover: [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)
- Troubleshoot ENS hook failures: [TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](./TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
- Understand ENS naming behavior: [ENS/ENS_JOB_PAGES_OVERVIEW.md](./ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Operate the standalone HTML UI artifact: [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- Track broader UI docs and release posture: [ui/README.md](./ui/README.md)

## Most common operator questions (fast answers)

- **What is canonical if docs disagree?** Follow the canonical set above (Hardhat guide, ENS replacement runbook, ENS overview, deployment troubleshooting).
- **What deployment path is recommended?** Hardhat is recommended/official; Truffle is legacy/supported only.
- **What is manual vs automated during ENS replacement?** Deploy + `setJobManager` are scripted; NameWrapper approval + `setEnsJobPages` + legacy migration are manual.
- **How are ENS names built?** `<prefix><jobId>.<jobsRootName>` where `AGIJobManager` provides `jobId` and `ENSJobPages` provides prefix/root.
- **When is locking safe?** Only after post-cutover read/event checks and any legacy migration decisions are complete.

## Core set

- [OVERVIEW.md](./OVERVIEW.md)
- [REPO_MAP.md](./REPO_MAP.md) *(generated)*
- [QUICKSTART.md](./QUICKSTART.md)
- [QUINTESSENTIAL_USE_CASE.md](./QUINTESSENTIAL_USE_CASE.md)
- [ui/README.md](./ui/README.md) (broader UI docs hub)
- [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md) (standalone HTML UI runbook)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT_OPERATIONS.md](./DEPLOYMENT_OPERATIONS.md)
- [Deployment Documentation Index (Hardhat recommended, Truffle legacy)](./DEPLOYMENT/README.md)
- [Ethereum Mainnet Beta Deployment Record](./DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)
- [Official Mainnet Deployment Record](./DEPLOYMENT/MAINNET_OFFICIAL_DEPLOYMENT_RECORD.md)
- [Owner Mainnet Deployment & Operations Guide](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) (institutional, web-only owner operations)
- [Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle)](./DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
- [SCRIPTS_REFERENCE.md](./SCRIPTS_REFERENCE.md)
- [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md)
- [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md)
- [INTEGRATIONS/ENS.md](./INTEGRATIONS/ENS.md)
- [INTEGRATIONS/ENS_ROBUSTNESS.md](./INTEGRATIONS/ENS_ROBUSTNESS.md)
- [INTEGRATIONS/ENS_USE_CASE.md](./INTEGRATIONS/ENS_USE_CASE.md)
- [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md)
- [OPERATIONS/MONITORING.md](./OPERATIONS/MONITORING.md)
- [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md)
- [OPERATIONS/JOB_LIFECYCLE_ETHERSCAN_GUIDE.md](./OPERATIONS/JOB_LIFECYCLE_ETHERSCAN_GUIDE.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [TESTING.md](./TESTING.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [GLOSSARY.md](./GLOSSARY.md)
- [LEGAL/TERMS_AND_CONDITIONS.md](./LEGAL/TERMS_AND_CONDITIONS.md)
- [POLICY/AI_AGENTS_ONLY.md](./POLICY/AI_AGENTS_ONLY.md)

## Generated references

- [REFERENCE/VERSIONS.md](./REFERENCE/VERSIONS.md)
- [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md)
- [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md)
- [REFERENCE/ENS_REFERENCE.md](./REFERENCE/ENS_REFERENCE.md)
- [REFERENCE/OPERATIONAL_LIMITS.md](./REFERENCE/OPERATIONAL_LIMITS.md)
- [REFERENCE/URIS_JOBSPEC_AND_COMPLETION.md](./REFERENCE/URIS_JOBSPEC_AND_COMPLETION.md)

## Design assets (text-only)

- [assets/palette.svg](./assets/palette.svg)
- [assets/architecture-wireframe.svg](./assets/architecture-wireframe.svg)


## Most common operator mistakes (avoid these)

- Assuming Hardhat scripts automatically do NameWrapper approval or `setEnsJobPages(...)` (they do not).
- Locking ENS/identity configuration before post-cutover checks and legacy migration decisions are complete.
- Expecting prefix changes to rename already snapshotted legacy labels.
- Treating ENS hook failures as protocol settlement failures without checking AGIJobManager events first.


## Etherscan safety boundaries (owner/operator)

- Safe and expected on Etherscan: owner reads, owner governance writes, NameWrapper approval, `setEnsJobPages`, migration calls.
- Script-first actions: contract deployment and source verification workflow.
- Never assume automation: NameWrapper approval and AGIJobManager pointer switch are always explicit manual transactions.
