# AGIJobManager Documentation Hub

> **v1.2.0: [Start here](START_HERE.md)** for the download, participant journey and role-specific instructions. Native six-decimal USDC is the only settlement token. This release supplies no live manager; historical receipts are not current deployments. Read [mainnet readiness](MAINNET_READINESS.md) before launch.

Guides for buyers, agents, reviewers, operators and developers. **Use the docs matching your release:** [v1.2.0 scope and earlier editions](V1_RELEASE_SCOPE.md#published-download-versus-current-source).

- **Become an agent:** [free identity, eligibility, work and payment](roles/AGENT.md).
- **Enable free agent identities:** [owner configuration walkthrough](NFT_POLICY.md#enable-the-free-alpha-agent-identity-route).
- **Understand missing or poor work:** [buyer protection](BUYER_PROTECTION.md) and [job specification template](BUYER_JOB_TEMPLATE.md).
- **Follow a real worked example:** [Genesis artwork job under today's rules](examples/GENESIS_JOB_TODAY.md), with historical evidence and a reproducible local simulation.

- **Reconcile funds and recover payments:** [read-only settlement status and recovery](OPERATIONS/SETTLEMENT_RECOVERY.md).

## Start here in one minute

- **Employer, agent or validator:** [Start here](START_HERE.md), then [participant guide](USERS.md).
- **Release reviewer:** [testing](TESTING.md), [mainnet readiness](MAINNET_READINESS.md) and [dependency security](DEPENDENCY_SECURITY.md).

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
| Standalone HTML UI artifact | Versioned, single-file, mainnet-focused browser artifact (`ui/agijobmanager-usdc.html`). | You need a direct operator/reviewer interface without running the full UI stack. | [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md) |
| Broader/full UI effort | Next.js UI with ongoing development, test, and release tracks. | You are developing, testing, or evaluating the full UI roadmap. | [ui/README.md](./ui/README.md) and [../ui/README.md](../ui/README.md) |



### UI task routing (fast path)

- **I need a single-file browser artifact for mainnet operations/review:** [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md)
- **I need a safe pre-sign workflow for the standalone page:** use the checklist and troubleshooting sections in [ui/GENESIS_JOB_MAINNET_HTML_UI.md](./ui/GENESIS_JOB_MAINNET_HTML_UI.md).
- **I need to understand what exists in `ui/` (including older snapshots):** [../ui/README.md](../ui/README.md)
- **I need the broader/full UI roadmap and runbooks:** [ui/README.md](./ui/README.md)


## Legal notices and independent operators

Use the [legal and operator protection center](LEGAL/README.md) for publisher protections, MIT licensing, source/console notices, privacy, jurisdiction scoping and a deployment-specific owner template. Technical readiness does not establish legal clearance. Existing guides describing v1.0.3 behavior remain applicable to v1.2.0 unless identified as historical.

## Standalone HTML UI safety routing

When you intentionally operate the single-file mainnet artifact (`ui/agijobmanager-usdc.html`), use this order:

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
- **Fresh scripted deployments:** `job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth`. Existing replacements preserve their root/prefix; `agijob` is the low-level constructor/legacy default. See [naming policy](ENS_DEPLOYMENT_NAMESPACES.md).
- **Responsibility split:** AGIJobManager decides numeric `jobId`; ENSJobPages decides prefix/root + snapshotting + ENS writes
- **Fresh USDC cutover order:** deploy a separate helper -> have the ENS parent create its dedicated wrapped-root token owned by the helper -> wire only the new manager -> validate creation, delegated writes and terminal revocation -> consider locks. Preserve original jobs and wiring.
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
- **What deployment path is recommended?** Hardhat 3 is the supported deployment and local test runtime; Truffle and Ganache have been removed.
- **What is manual vs automated during ENS replacement?** The helper script deploys, checks runtime, sets its manager, verifies source and transfers to the explicit owner. Dedicated-root setup and the new manager pointer are manual. Same-manager page migration and any broad wrapper authority are separately reviewed; fresh USDC does not repoint original jobs.
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
- [Deployment Documentation Index (Hardhat and retired guides)](./DEPLOYMENT/README.md)
- [Ethereum Mainnet Beta Deployment Record](./DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)
- [Official Mainnet Deployment Record](./DEPLOYMENT/MAINNET_OFFICIAL_DEPLOYMENT_RECORD.md)
- [Owner Mainnet Deployment & Operations Guide](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) (institutional, web-only owner operations)
- [Retired Truffle deployment guide](./DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
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

- Assuming Hardhat scripts create the dedicated root or call the new manager’s `setEnsJobPages(...)` (they do not), or granting unnecessary blanket authority over legacy names.
- Locking ENS/identity configuration before post-cutover checks and legacy migration decisions are complete.
- Expecting prefix changes to rename already snapshotted legacy labels.
- Treating ENS hook failures as protocol settlement failures without checking AGIJobManager events first.


## Etherscan safety boundaries (owner/operator)

- A verified explorer supports read checks and reviewed owner writes. Verify network, contract, method, inputs and signer independently; using an explorer alone does not establish safety.
- Script-first actions: contract deployment and source verification workflow.
- Dedicated-root setup and the new manager pointer switch require the respective authorized owners. Same-manager page migration is a separate procedure, not a fresh-USDC step.
