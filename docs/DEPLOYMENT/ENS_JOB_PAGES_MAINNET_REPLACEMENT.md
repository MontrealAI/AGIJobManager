# ENSJobPages Mainnet Replacement Runbook

This runbook is for replacing the `ENSJobPages` contract used by AGIJobManager on Ethereum mainnet, without changing AGIJobManager protocol behavior.

## In one minute

Canonical cutover flow:
1. Deploy new `ENSJobPages` (Hardhat script).
2. Wrapped-root owner manually calls `NameWrapper.setApprovalForAll(newEnsJobPages, true)`.
3. AGIJobManager owner manually calls `AGIJobManager.setEnsJobPages(newEnsJobPages)`.
4. Migrate legacy jobs with historical labels if needed (`migrateLegacyWrappedJobPage`).
5. Lock configuration only after validation is complete.

---

## 1.1) Who does which action

| Action | Automated by script? | Required caller |
| --- | --- | --- |
| Deploy new `ENSJobPages` | Yes | deployer key |
| `setJobManager(JOB_MANAGER)` on new ENSJobPages | Yes | deployer key |
| NameWrapper `setApprovalForAll(newEnsJobPages, true)` | No (manual) | wrapped-root owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No (manual) | AGIJobManager owner |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` | No (manual, if needed) | ENSJobPages owner |
| `lockConfiguration()` | Optional/manual | ENSJobPages owner |

---

## 1) Purpose and scope

`ENSJobPages` manages ENS job page naming and metadata writes for AGIJobManager hooks.

It determines:
- job label prefix (`jobLabelPrefix`, default `agijob`),
- job root suffix (`jobsRootName`, default in deploy script: `alpha.jobs.agi.eth`),
- and stores snapshotted exact labels for each job.

`AGIJobManager` contributes the numeric `jobId`; `ENSJobPages` builds names from that `jobId`.

---

## 2) Why replacement might be needed

Typical replacement/migration drivers from current contract behavior:
- You need newer `ENSJobPages` behavior for label snapshotting and legacy migration support.
- Old jobs may not have label snapshots in the new contract, causing post-create writes to revert with `JobLabelNotSnapshotted` until migrated.
- Wrapped-root operations require explicit NameWrapper approval to the active `ENSJobPages`; missing approval blocks wrapped-root writes.

---

## 3) Current default naming behavior

## 3.1) Canonical naming and responsibility split
- Name format: `<prefix><jobId>.<jobsRootName>`.
- `AGIJobManager` decides numeric `jobId` and protocol settlement state.
- `ENSJobPages` decides `prefix`, `jobsRootName`, label snapshotting, and ENS write behavior.


With script defaults + contract defaults:
- `jobLabelPrefix = "agijob"`
- `jobsRootName = "alpha.jobs.agi.eth"`

So names are:
- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`
- ...

Prefix changes apply only to unsnapshotted/future jobs. Already snapshotted labels stay unchanged.

---

## 4) Mainnet-sensitive warnings

- Mainnet deploy scripts require: `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`.
- `lockConfiguration()` on ENSJobPages is irreversible.
- Wiring the wrong ENSJobPages address into AGIJobManager changes hook target for all future calls.
- If NameWrapper approval is missing on wrapped root, create/adopt/write paths can fail best-effort.

---

## 5) Preconditions

- You control deployer key and owner key(s) needed for manual wiring.
- `hardhat/.env` is configured.
- You know the intended AGIJobManager address for `JOB_MANAGER`.
- You have identified whether your jobs root is wrapped or unwrapped.

---

## 6) Exact deployment flow (mainnet)

```bash
cd hardhat
npm ci
cp .env.example .env
npm run compile

DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet

DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npm run deploy:ens-job-pages:mainnet
```

Optional overrides (via `.env`):
- `JOB_MANAGER`
- `JOBS_ROOT_NAME`
- `JOBS_ROOT_NODE` (must match `namehash(JOBS_ROOT_NAME)`)
- `ENS_REGISTRY`
- `NAME_WRAPPER`
- `PUBLIC_RESOLVER`
- `LOCK_CONFIG=1`

Expected result:
- New ENSJobPages address deployed.
- `setJobManager(JOB_MANAGER)` already executed by script.
- Optional verification submitted.


### Common cutover mistakes
- Performing only deploy, but forgetting manual NameWrapper approval.
- Performing NameWrapper approval, but forgetting `setEnsJobPages(newAddress)`.
- Locking configuration before validating at least one future job hook and any required legacy migration.
- Supplying an inexact `exactLabel` in legacy migration calls.

---

## 7) Required manual post-deploy wiring on mainnet

What is automated vs manual:
- Automated by deploy script: deploy contract, set `jobManager`, optional ownership transfer/verification.
- Manual on mainnet: NameWrapper approval + AGIJobManager `setEnsJobPages`.


### Step 1 — NameWrapper approval (wrapped root)
Caller: wrapped-root owner account.

On NameWrapper:
- `setApprovalForAll(newEnsJobPages, true)`

Why this matters:
- ENSJobPages checks wrapper authorization before wrapped-root create/adopt operations.

### Step 2 — Point AGIJobManager to the new ENSJobPages
Caller: AGIJobManager owner account.

On AGIJobManager:
- `setEnsJobPages(newEnsJobPages)`

Why this matters:
- AGIJobManager calls ENS hooks on the configured `ensJobPages` target only.

Expected result after wiring:
- New hook calls route to the new ENSJobPages contract.
- On AGIJobManager `Read Contract`, `ensJobPages` equals `newEnsJobPages`.
- On NameWrapper `Read Contract`, `isApprovedForAll(rootOwner, newEnsJobPages)` is true (or token-level approval exists).

---


## 7.1) Post-wiring expected checks (copy/paste checklist)

- [ ] AGIJobManager `ensJobPages()` equals `newEnsJobPages`.
- [ ] NameWrapper `isApprovedForAll(rootOwner, newEnsJobPages)` is `true` (or token-level approval equivalent).
- [ ] New job hook transaction shows protocol success (`status=1`).
- [ ] ENSJobPages events include `ENSHookProcessed` (or explicit skip/failure reason).

## 8) Legacy migration for old wrapped job pages

If a legacy job page exists under a historical exact label, migrate by importing the exact label:

- `migrateLegacyWrappedJobPage(jobId, exactLabel)` on ENSJobPages owner account.

Use this when post-create write hooks fail because label was never snapshotted in the current ENSJobPages.

Important:
- `exactLabel` must match the real label for that `jobId` (including numeric suffix).
- Migration snapshots/adopts/creates as needed, then best-effort updates resolver/auth/text.
- If a wrapped child is no longer parent-controllable (for example, emancipated), migration adoption can fail and revert (`ENSNotAuthorized`).

Expected result:
- `LegacyJobPageMigrated(jobId, node, label, adopted, created)` emitted.
- Subsequent write hooks for that job can resolve node from snapshotted label.
- If wrapped-child adoption is blocked (for example, child no longer parent-controllable), migration reverts and no `LegacyJobPageMigrated` event is emitted; treat this as a failed migration that needs operator remediation before retry.

---

## 8.1) Future jobs vs legacy jobs after cutover (expected behavior)

- **Future/unsnapshotted jobs:** new creates use `<prefix><jobId>.<jobsRootName>` (default prefix `agijob`) and should proceed once wiring is complete.
- **Legacy snapshotted jobs:** keep their historical label; they do not auto-rename on prefix changes.
- **Legacy unsnapshotted jobs:** may need `migrateLegacyWrappedJobPage(jobId, exactLabel)` before deterministic write hooks succeed.

---

## 9) Etherscan confirmation checks

On new ENSJobPages (`Read Contract`):
- `jobManager` equals target AGIJobManager.
- `jobsRootName` and `jobsRootNode` are expected values.
- `jobLabelPrefix` expected default or configured value.

On AGIJobManager (`Read Contract`):
- `ensJobPages` equals new ENSJobPages address.

On NameWrapper (`Read Contract`):
- `isApprovedForAll(rootOwner, newEnsJobPages)` is `true` (or token-level approval exists).

Event checks:
- ENSJobPages deployment tx + ownership transfer (if used).
- AGIJobManager `EnsJobPagesUpdated(old,new)` event.

---

## 10) Rollback / recovery considerations

- If AGIJobManager was wired to the wrong ENSJobPages, owner can call `setEnsJobPages(previousAddress)` (if identity config still configurable).
- If NameWrapper approval is incorrect, correct with `setApprovalForAll(correctEnsJobPages, true)`.
- If legacy writes fail for specific jobs, run `migrateLegacyWrappedJobPage(jobId, exactLabel)` per affected job.
- If verification API fails, use deployment artifact `solc-input.json` for manual standard-json verify.

---

## 11) Operator “done successfully” checklist

- [ ] Dry run reviewed and approved.
- [ ] ENSJobPages deployed and (if required) verified.
- [ ] NameWrapper approval granted for wrapped root.
- [ ] AGIJobManager `setEnsJobPages(new)` executed.
- [ ] Etherscan read checks pass on all key fields.
- [ ] At least one new job hook observed successfully.
- [ ] Legacy jobs requiring migration identified and migrated.

## 12) Before locking ENSJobPages configuration

- [ ] All addresses (`ens`, `nameWrapper`, `publicResolver`, `jobManager`) are final.
- [ ] `jobsRootName`/`jobsRootNode` are final and validated.
- [ ] Wrapped-root approval already works.
- [ ] Migration backlog is complete or explicitly tracked.
- [ ] You acknowledge `lockConfiguration()` is irreversible.


## 13) Common mistakes (do not do this)

- Do not assume deploy scripts perform NameWrapper approval.
- Do not forget `setEnsJobPages(newEnsJobPages)` on AGIJobManager owner account.
- Do not change prefix expecting old snapshotted labels to rename automatically.
- Do not lock configuration before validating future-job hooks and legacy-job migration needs.
- Do not treat ENS hook best-effort failures as proof that settlement failed; check AGIJobManager settlement events separately.


## 13.1) Migration-specific mistakes

- Calling `setEnsJobPages(new)` before wrapped-root approval is in place, then misreading hook failures as total protocol failure.
- Locking ENSJobPages configuration before future-job hook validation and legacy migration checks.
- Using approximate labels for migration; `exactLabel` must match historical on-chain label.
