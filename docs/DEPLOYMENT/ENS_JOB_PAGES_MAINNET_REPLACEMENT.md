# ENSJobPages Mainnet Replacement Runbook

This runbook is for production operators replacing `ENSJobPages` on Ethereum mainnet without changing AGIJobManager protocol behavior.

## 1) Purpose

`ENSJobPages` is the ENS companion contract that handles job subname creation and metadata/authorization updates when AGIJobManager emits ENS hooks.

It determines:

- label prefix (`jobLabelPrefix`, default `agijob`),
- root suffix (`jobsRootName`, e.g. `alpha.jobs.agi.eth`),
- node ownership route (wrapped root via NameWrapper or unwrapped root via ENS registry).

AGIJobManager supplies the numeric `jobId`.

Default naming examples with current defaults:

- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`

## 2) Why older deployments may fail for `job-0` / legacy pages

Legacy or pre-snapshot jobs can fail on post-create write hooks (`assign`, `completion`, `revoke`, `lock`) because the new write path requires a snapshotted/imported label for the job ID.

Relevant behavior in contract:

- `_resolvedJobNodeForWrite(jobId)` reverts with `JobLabelNotSnapshotted` if no label snapshot exists.
- `migrateLegacyWrappedJobPage(jobId, exactLabel)` exists to import exact historical labels and adopt/create ENS subnames for legacy jobs.

Operational implication: if old jobs were created under legacy labels, migrate them with the exact label string before expecting write hooks to mutate those records.

## 3) Preconditions (mainnet)

- You control deployer key for new contract deployment.
- You control AGIJobManager owner account (for `setEnsJobPages`).
- You control wrapped-root owner account (for NameWrapper approval), or equivalent authority.
- You know the intended `JOB_MANAGER`, `JOBS_ROOT_NAME`, and ENS infra addresses.

> ⚠️ **Mainnet-sensitive:** do not proceed unless you have tested this flow on Sepolia or dry-run output and addresses are reviewed.

## 4) Deployment flow (exact commands)

### 4.1 Setup and compile

```bash
cd hardhat
npm ci
cp .env.example .env
npm run compile
```

Set at least in `.env`:

- `MAINNET_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`

### 4.2 Dry-run plan (required)

```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet
```

Expected result:

- Script prints deployment plan including registry/wrapper/resolver/root/jobManager values.
- Script exits before broadcasting txs.

### 4.3 Mainnet deploy

```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet
```

Expected result:

- New ENSJobPages contract deployed.
- `setJobManager(jobManager)` executed.
- Optional verification attempted.
- Optional ownership transfer executed if `NEW_OWNER`/`FINAL_OWNER` set.

## 5) Manual post-deploy wiring (required)

These steps are not automated by deploy script.

### 5.1 NameWrapper approval

On NameWrapper, wrapped-root owner calls:

- `setApprovalForAll(newEnsJobPages, true)`

Why this matters:

- Wrapped-root subname operations in ENSJobPages require wrapper authorization.

### 5.2 AGIJobManager wiring

On AGIJobManager, owner calls:

- `setEnsJobPages(newEnsJobPages)`

Why this matters:

- AGIJobManager only sends hooks to its configured ENSJobPages address.

> ⚠️ **Mainnet-sensitive:** if you skip either step, ENS hooks can continue failing or be routed to old address.

## 6) Legacy migration flow (wrapped job pages)

When old jobs use historical labels that were never snapshotted in the replacement contract, run:

- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

Requirements:

- `exactLabel` must exactly match the historical label for that `jobId`.
- For wrapped roots, NameWrapper authorization must already be present.

What it does:

- imports/snapshots label,
- adopts existing subname if present and manageable,
- or creates subname if absent,
- reapplies resolver/auth/text best-effort updates.

Expected result:

- `LegacyJobPageMigrated(jobId, node, label, adopted, created)` emitted.

## 7) Verification checks (Etherscan/operator checks)

After wiring:

1. AGIJobManager `ensJobPages()` == new address.
2. NameWrapper `isApprovedForAll(wrappedRootOwner, newEnsJobPages)` == `true`.
3. ENSJobPages read checks:
   - `jobManager()` == AGIJobManager
   - `jobsRootName()` expected suffix (e.g. `alpha.jobs.agi.eth`)
   - `jobLabelPrefix()` expected prefix (default `agijob`)
4. Test one new job and confirm `jobEnsName(jobId)` resolves expected value.
5. For migrated legacy job IDs, confirm no `JobLabelNotSnapshotted` failures on write hooks.

## 8) Recovery / rollback considerations

If replacement causes issues:

- You can repoint AGIJobManager to previous ENSJobPages by calling `setEnsJobPages(oldAddress)` from AGIJobManager owner.
- Keep prior ENSJobPages address and ABI/operator notes available before change window.
- Do not lock new ENSJobPages config until post-deploy checks and legacy migrations are complete.

> ⚠️ **Irreversibility warning:** if `lockConfiguration()` is executed on ENSJobPages, config setters become unavailable.

## 9) Operator completion checklist

### Done successfully

- [ ] Dry-run reviewed and archived.
- [ ] New ENSJobPages deployed and (if desired) verified.
- [ ] NameWrapper approval granted for new ENSJobPages.
- [ ] AGIJobManager updated via `setEnsJobPages(newEnsJobPages)`.
- [ ] At least one new job page created successfully.
- [ ] Required legacy jobs migrated with `migrateLegacyWrappedJobPage`.

### Before locking configuration

- [ ] `ens`, `nameWrapper`, `publicResolver`, `jobsRootNode`, `jobsRootName`, `jobManager` confirmed final.
- [ ] All required legacy migrations completed.
- [ ] Hook health observed on live job actions.
- [ ] Rollback address/runbook captured.
