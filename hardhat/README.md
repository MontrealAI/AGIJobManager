# Hardhat Operator Guide (Official / Recommended)

This `hardhat/` project is the official deployment and verification workflow for AGIJobManager.

> Truffle remains supported as a legacy path. Hardhat is the recommended production path for new deployments and replacements.

UI note: this guide is deployment authority. For the standalone mainnet browser artifact, see `../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`; use UI only after deploy/cutover steps are complete.

## In one minute (mainnet-safe path)

1. Run compile + `DRY_RUN=1` first.
2. Deploy `AGIJobManager` and/or new `ENSJobPages` with mainnet confirmation gate.
3. Complete manual wiring in strict order:
   - wrapped-root owner: `NameWrapper.setApprovalForAll(newEnsJobPages, true)`
   - AGIJobManager owner: `AGIJobManager.setEnsJobPages(newEnsJobPages)`
4. Validate on Etherscan (`status=1`, `ensJobPages` pointer, hook events).
5. Migrate legacy jobs if historical labels must be retained.
6. Only then consider irreversible `lockConfiguration()`.

## Who signs which transaction

| Transaction | Required signer | Notes |
| --- | --- | --- |
| `scripts/deploy.js` / `scripts/deploy-ens-job-pages.js` | deployer key | contract deploy + scripted setup |
| `NameWrapper.setApprovalForAll(newEnsJobPages, true)` | wrapped-root owner | manual, always required for wrapped-root control |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | AGIJobManager owner | manual pointer switch to new ENSJobPages |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` | ENSJobPages owner | manual, only for affected legacy jobs |
| `lockConfiguration()` | ENSJobPages owner | irreversible; do only after validation |

---

## 1) What this workflow does and does not do

### Does
- Compiles contracts with pinned production compiler settings.
- Deploys linked libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).
- Deploys `AGIJobManager` from `scripts/deploy.js`.
- Attempts Etherscan verification.
- Optionally transfers AGIJobManager ownership to `FINAL_OWNER`.
- Writes deployment artifacts for auditability and manual verification fallback.
- Provides additive utility script to deploy/replace `ENSJobPages` (`scripts/deploy-ens-job-pages.js`).

### Does not
- Perform runtime protocol tuning after deployment (pause flags, thresholds, roots, etc.).
- Execute ENS NameWrapper approval.
- Wire AGIJobManager to a new ENSJobPages automatically.

Those two ENS wiring actions are manual post-deploy wiring steps and are required on mainnet when replacing ENSJobPages.

### Manual vs automated at cutover

| Step | Automated by script | Manual action |
| --- | --- | --- |
| Deploy `ENSJobPages` | Yes | No |
| `setJobManager(JOB_MANAGER)` on new ENSJobPages | Yes | No |
| NameWrapper `setApprovalForAll(newEnsJobPages, true)` | No | Yes, by wrapped-root owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No | Yes, by AGIJobManager owner |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` | No | Yes, if legacy jobs require it |


### Manual-only steps that are easy to miss

These are never auto-executed by the deployment scripts:
- `NameWrapper.setApprovalForAll(newEnsJobPages, true)` by **wrapped-root owner**
- `AGIJobManager.setEnsJobPages(newEnsJobPages)` by **AGIJobManager owner**
- `migrateLegacyWrappedJobPage(jobId, exactLabel)` by **ENSJobPages owner** (only when needed)

If you skip them, deployment can appear successful while ENS behavior is still partially cut over.

---

## 2) Deployment paths in this repo

- **Official / recommended:** this Hardhat folder.
- **Legacy / supported:** root Truffle flow and legacy deployment docs in `docs/DEPLOYMENT/`.

Legacy references:
- `../docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md`
- `../docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md`
- `../docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md`

---

## 3) Prerequisites

```bash
cd hardhat
npm ci
cp .env.example .env
```

Required in `.env`:
- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `DEPLOY_CONFIRM_MAINNET` (required on chainId 1)

Common optional controls:
- `FINAL_OWNER`
- `CONFIRMATIONS` (default `3`)
- `VERIFY_DELAY_MS` (default `3500`)
- `DRY_RUN=1`
- `DEPLOY_CONFIG` (path override for deploy profile)

Mainnet confirmation gate value:

```text
I_UNDERSTAND_MAINNET_DEPLOYMENT
```

> ⚠️ Mainnet-sensitive: both deploy scripts hard-fail on chainId 1 unless `DEPLOY_CONFIRM_MAINNET` exactly matches this phrase.

---

## 4) Compiler and profile source of truth

- Hardhat config: `hardhat.config.js`.
- Default constructor profile: `deploy.config.example.js`.
- Optional profile override: set `DEPLOY_CONFIG=<path-to-js-config>`.

`deploy.js` resolves constructor args from the profile for the current network and validates address/bytes32 shapes before broadcasting.

---

## 5) Compile

```bash
cd hardhat
npm run compile
```

If imports fail for `@openzeppelin/contracts`, run `npm ci` in this `hardhat/` folder (it is a separate Node project from repo root).

Expected result:
- Hardhat compilation succeeds.
- Artifacts are written under `hardhat/artifacts`.

---

## 6) Dry-run before any mainnet transaction

AGIJobManager deploy plan:

```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

ENSJobPages deploy plan:

```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet
```

Expected result:
- Script prints full plan.
- Script exits before broadcasting transactions.

---

## 7) Deploy AGIJobManager (mainnet)

```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Optional owner override:

```bash
cd hardhat
FINAL_OWNER=0xYourOwner DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Expected result:
- Libraries + `AGIJobManager` deployed.
- Verification attempts executed.
- Optional `transferOwnership(finalOwner)` executed if deployer != final owner.
- Deployment records written under `hardhat/deployments/mainnet/`.

### Output artifacts to keep
- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

These are audit artifacts and a fallback for manual Etherscan standard-json verification.

---

## 8) Deploy or replace ENSJobPages (mainnet additive flow)

`ENSJobPages` deploy script:
- `scripts/deploy-ens-job-pages.js`
- Deploys `ENSJobPages`
- Sets `setJobManager(JOB_MANAGER)` on the new contract
- Optional: ownership transfer (`NEW_OWNER`/`FINAL_OWNER`)
- Optional: `lockConfiguration()` if `LOCK_CONFIG=1`
- Optional verification if `VERIFY=1`

### Mainnet command sequence

```bash
cd hardhat
npm run compile
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npm run deploy:ens-job-pages:mainnet
```

Defaults in the script for mainnet context:
- ENS registry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- NameWrapper: `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- Public resolver: `0xF29100983E058B709F3D539b0c765937B804AC15`
- `JOB_MANAGER`: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
- `JOBS_ROOT_NAME`: `alpha.jobs.agi.eth`

You may override with `.env` values if needed (`JOB_MANAGER`, `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE`, `ENS_REGISTRY`, `NAME_WRAPPER`, `PUBLIC_RESOLVER`).

> ⚠️ Mainnet-sensitive: if you set `LOCK_CONFIG=1`, ENSJobPages config setters become permanently unavailable.

---

## ENSJobPages replacement: safe cutover checklist

Before broadcasting on mainnet:
- [ ] Confirm `JOB_MANAGER` is the intended AGIJobManager contract.
- [ ] Confirm `JOBS_ROOT_NAME` and `JOBS_ROOT_NODE` match.
- [ ] Dry-run output reviewed (`DRY_RUN=1`).
- [ ] Wrapped-root owner is ready to execute NameWrapper approval.
- [ ] AGIJobManager owner is ready to execute `setEnsJobPages(newAddress)`.
- [ ] Legacy jobs requiring migration are identified.

After deploy and wiring:
- [ ] `isApprovedForAll(rootOwner, newEnsJobPages) == true` (or token-level equivalent).
- [ ] `AGIJobManager.ensJobPages() == newEnsJobPages`.
- [ ] At least one new/future job hook succeeds.
- [ ] Legacy jobs that need historical labels are migrated.
- [ ] Only then evaluate `lockConfiguration()`.

> 🚫 Do not lock ENSJobPages configuration during initial cutover unless all validation checks are already complete.

---

## 9) Required manual post-deploy wiring (mainnet)

These actions are intentionally manual and not automated by scripts.

1. On **NameWrapper**, wrapped-root owner calls:
   - `setApprovalForAll(newEnsJobPages, true)`
2. On **AGIJobManager**, owner calls:
   - `setEnsJobPages(newEnsJobPages)`

Why this matters:
- Without NameWrapper approval, wrapped-root writes can fail (subname create/adopt, resolver operations).
- Without `setEnsJobPages`, AGIJobManager keeps calling the old ENSJobPages address.

Expected result:
- New jobs/hooks route to the new ENSJobPages.
- `ENSJobPages._isFullyConfigured()` conditions are satisfied for hook processing.

Detailed replacement + migration runbook:
- `../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`

### Legacy migration decision checklist
- If a legacy job already has correct snapshot in new ENSJobPages, no migration call is needed.
- If `jobLabelSnapshot(jobId)` is missing and writes fail, run `migrateLegacyWrappedJobPage(jobId, exactLabel)`.
- If migration reverts with authorization issues (for example emancipated child), treat as ownership remediation task before retrying.

### Expected successful output signals
- Deploy script prints deployed ENSJobPages address and owner/job manager summary.
- Mainnet wiring tx receipts are `status = 1` on Etherscan.
- AGIJobManager emits `EnsJobPagesUpdated(old,new)` for cutover transaction.
- ENS hook events on the new ENSJobPages show `ENSHookProcessed` for future jobs.

---

### Rollback / recovery (operational)
- Wrong ENSJobPages in AGIJobManager: call `setEnsJobPages(previousAddress)` from AGIJobManager owner (if identity config is still unlocked).
- Missing/incorrect wrapper approval: wrapped-root owner calls `setApprovalForAll(correctEnsJobPages, true)`.
- Legacy job still failing ENS writes: migrate with `migrateLegacyWrappedJobPage(jobId, exactLabel)`.

## 10) Etherscan verification and manual fallback

Automated path:
- `deploy.js` and `deploy-ens-job-pages.js` use `@nomicfoundation/hardhat-verify` when configured.

Fallback path:
- Use `solc-input.json` and compiler settings from this repo for Etherscan standard-json verification.

Troubleshooting reference:
- `../docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`

---

### Do not do this by accident
- Do **not** set `LOCK_CONFIG=1` during initial cutover unless full validation is complete.
- Do **not** assume scripts perform NameWrapper approval or AGIJobManager `setEnsJobPages(...)`.
- Do **not** expect prefix changes to rename snapshotted legacy labels.

## 11) Operator checklists

### Done successfully checklist
- [ ] Dry-run output reviewed.
- [ ] Mainnet deploy transaction(s) mined.
- [ ] Verification complete or manual fallback documented.
- [ ] Deployment JSON + solc-input + verify-targets archived.
- [ ] (If ENS replacement) NameWrapper approval granted.
- [ ] (If ENS replacement) AGIJobManager `setEnsJobPages(newAddress)` completed.
- [ ] Etherscan read checks confirm expected addresses.

### Before locking ENSJobPages configuration
- [ ] `ens`, `nameWrapper`, `publicResolver` are correct.
- [ ] `jobsRootNode` and `jobsRootName` are correct and match.
- [ ] `jobManager` is correct AGIJobManager address.
- [ ] NameWrapper approval is already valid for wrapped root.
- [ ] You have tested at least one create/write path.
- [ ] You understand `lockConfiguration()` is irreversible.
