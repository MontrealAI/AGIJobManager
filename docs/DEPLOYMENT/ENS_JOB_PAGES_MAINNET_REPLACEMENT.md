# ENSJobPages Mainnet Replacement Runbook

This runbook explains how to replace `ENSJobPages` on Ethereum mainnet while preserving AGIJobManager protocol behavior.

---

## 1) Purpose

`ENSJobPages` is the ENS-side lifecycle helper used by AGIJobManager hooks.

It determines:
- label prefix (`jobLabelPrefix`, default `agijob`),
- root suffix (`jobsRootName`, default from script `alpha.jobs.agi.eth`),
- per-job exact label snapshot used for deterministic post-create writes.

`AGIJobManager` contributes only the numeric `jobId`.

Effective name format:

```text
<jobLabelPrefix><jobId>.<jobsRootName>
```

Current default examples:
- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`

---

## 2) Why replacement may be required

Common operational reasons:
- Replace ENSJobPages implementation while keeping AGIJobManager unchanged.
- Enable robust handling for legacy wrapped pages where labels were not snapshotted in the new contract.
- Recover from old wiring/configuration mistakes.

Important behavior to understand:
- Post-create write hooks in ENSJobPages rely on snapshotted labels.
- Legacy jobs without snapshots can fail with `JobLabelNotSnapshotted` until migrated.

---

## 3) Mainnet-sensitive warnings

- Both deploy scripts require `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT` on chainId 1.
- Calling `lockConfiguration()` is irreversible.
- Wiring AGIJobManager to the wrong ENSJobPages changes hook target for all future hook calls.
- Missing NameWrapper approval can prevent wrapped-root create/adopt/update operations.

---

## 4) Preconditions checklist

- [ ] You control deployer and owner accounts required for post-deploy wiring.
- [ ] `hardhat/.env` is configured with RPC/private key/Etherscan key.
- [ ] Intended AGIJobManager address for `JOB_MANAGER` is confirmed.
- [ ] Wrapped vs unwrapped root status is known.
- [ ] You have a rollback plan (previous ENSJobPages address recorded).

---

## 5) Exact deployment flow (mainnet)

```bash
cd hardhat
npm ci
cp .env.example .env
npm run compile

DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet

DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npm run deploy:ens-job-pages:mainnet
```

Optional `.env` overrides:
- `JOB_MANAGER`
- `JOBS_ROOT_NAME`
- `JOBS_ROOT_NODE` (must match `namehash(JOBS_ROOT_NAME)`)
- `ENS_REGISTRY`
- `NAME_WRAPPER`
- `PUBLIC_RESOLVER`
- `LOCK_CONFIG=1`

Expected result:
- New ENSJobPages address is deployed.
- `setJobManager(JOB_MANAGER)` executed by script.
- Optional ownership transfer executed.
- Optional verification submitted.

---

## 6) Required manual post-deploy wiring (mainnet)

These two calls are mandatory for a wrapped-root replacement.

### Step 1 — NameWrapper approval
Caller: wrapped-root owner account.

On NameWrapper call:
- `setApprovalForAll(newEnsJobPages, true)`

Why this matters:
- ENSJobPages needs operator rights for wrapped-root subname create/adopt flows.

Expected result:
- `isApprovedForAll(rootOwner, newEnsJobPages)` returns `true`.

### Step 2 — Switch AGIJobManager to new ENSJobPages
Caller: AGIJobManager owner account.

On AGIJobManager call:
- `setEnsJobPages(newEnsJobPages)`

Why this matters:
- AGIJobManager only emits hooks to configured `ensJobPages`.

Expected result:
- AGIJobManager `ensJobPages` getter returns `newEnsJobPages`.
- New jobs/hooks route to replacement contract.

---

## 7) Legacy migration for old wrapped job pages

Use when old jobs fail post-create writes due to missing label snapshot.

Function:
- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

Caller:
- ENSJobPages owner.

Requirements:
- `exactLabel` must exactly match historical label for the given `jobId`.

What migration does:
- snapshots/imports exact label,
- adopts existing wrapped subname or creates it if needed,
- applies best-effort resolver/auth/text updates.

Expected result:
- `LegacyJobPageMigrated(jobId, node, label, adopted, created)` event emitted.
- `jobLabelSnapshot(jobId)` returns `(true, exactLabel)`.
- Later write hooks can resolve node from snapshot.

---

## 8) Etherscan confirmation checklist

### ENSJobPages (new contract, Read Contract)
- `jobManager` is expected AGIJobManager.
- `jobsRootName` and `jobsRootNode` are expected and consistent.
- `jobLabelPrefix` is expected (default `agijob` unless changed).
- `configLocked` matches intended state.

### AGIJobManager (Read Contract)
- `ensJobPages` equals new ENSJobPages address.

### NameWrapper (Read Contract)
- `isApprovedForAll(rootOwner, newEnsJobPages) == true` (or equivalent token approval path).

### Event checks
- ENSJobPages deployment transaction.
- Ownership transfer event (if used).
- AGIJobManager `EnsJobPagesUpdated(old,new)` event.

---

## 9) Recovery / rollback considerations

- Wrong ENSJobPages configured in AGIJobManager:
  - Owner can call `setEnsJobPages(previousAddress)` if identity configuration is still allowed.
- Missing NameWrapper approval:
  - grant `setApprovalForAll(correctEnsJobPages, true)` from wrapped-root owner.
- Legacy writes still failing:
  - run `migrateLegacyWrappedJobPage(jobId, exactLabel)` for each affected job.
- Verification API issues:
  - use `hardhat/deployments/<network>/solc-input.json` for manual standard-json verification.

---

## 10) Operator checklists

### Done successfully
- [ ] Dry run reviewed.
- [ ] ENSJobPages deployed and (if needed) verified.
- [ ] NameWrapper approval granted.
- [ ] AGIJobManager wired with `setEnsJobPages(new)`.
- [ ] Etherscan read checks pass.
- [ ] One end-to-end create/write path validated.
- [ ] Legacy jobs needing migration identified and handled.

### Before locking ENSJobPages configuration
- [ ] `ens`, `nameWrapper`, `publicResolver`, `jobManager` are final.
- [ ] `jobsRootName` and `jobsRootNode` are final and matched.
- [ ] NameWrapper approval confirmed.
- [ ] Legacy migration backlog resolved or formally tracked.
- [ ] You explicitly acknowledge `lockConfiguration()` is irreversible.
