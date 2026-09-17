# ENSJobPages Mainnet Replacement Runbook

This runbook replaces `ENSJobPages` for the **same, verified USDC manager**. It does not migrate the legacy mainnet manager to USDC. For that transition, use the [USDC cutover qualification and preservation plan](../qualification/USDC_CUTOVER.md): deploy a separate helper and namespace, and preserve the legacy manager's ENS wiring and original-asset exits.

## In one minute

Canonical cutover flow:
1. Deploy new `ENSJobPages` (Hardhat script).
2. Establish the new helper's authority over the reviewed jobs root. Prefer a dedicated root owned by the helper; otherwise review the scope of any NameWrapper operator approval.
3. AGIJobManager owner manually calls `AGIJobManager.setEnsJobPages(newEnsJobPages)`.
4. For existing jobs of this same manager only, migrate historical page labels if needed (`migrateLegacyWrappedJobPage`). Never import the original mainnet manager’s pages or balances into a fresh USDC manager.
5. Lock configuration only after validation is complete.

---

## 1.1) Who does which action

| Action | Automated by script? | Required caller |
| --- | --- | --- |
| Deploy new `ENSJobPages` | Yes | deployer key |
| `setJobManager(JOB_MANAGER)` on new ENSJobPages | Yes | deployer key |
| Establish dedicated-root ownership by the new helper | No (manual) | ENS parent owner |
| Broader NameWrapper approval, only for a separately reviewed same-manager wrapped-root replacement | No (manual) | wrapped-root owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No (manual) | AGIJobManager owner |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` | No (manual, if needed) | ENSJobPages owner |
| `lockConfiguration()` | Optional/manual | ENSJobPages owner |

---

## 1) Purpose and scope

`ENSJobPages` manages ENS job page naming and metadata writes for AGIJobManager hooks.

It determines:
- job label prefix (`jobLabelPrefix`, default `agijob`),
- job root suffix (`jobsRootName`, explicitly required by the deploy script),
- and stores snapshotted exact labels for each job.

`AGIJobManager` contributes the numeric `jobId`; `ENSJobPages` builds names from that `jobId`.

---

## 2) Why replacement might be needed

Typical replacement/migration drivers from current contract behavior:
- You need newer `ENSJobPages` behavior for label snapshotting and legacy migration support.
- Old jobs may not have label snapshots in the new contract, causing post-create writes to revert with `JobLabelNotSnapshotted` until migrated.
- A wrapped-root replacement must establish supported ownership/approval for the active `ENSJobPages`; missing authority blocks wrapped-root writes. A fresh dedicated root can instead be directly owned by the helper.

---

## 3) Current default naming behavior

## 3.1) Canonical naming and responsibility split
- Name format: `<prefix><jobId>.<jobsRootName>`.
- `AGIJobManager` decides numeric `jobId` and protocol settlement state.
- `ENSJobPages` decides `prefix`, `jobsRootName`, label snapshotting, and ENS write behavior.


Example using the isolated namespace exercised in the fork rehearsal (a proposal, not a live deployment):
- `jobLabelPrefix = "agijob"`
- `jobsRootName = "usdc-v092.alpha.jobs.agi.eth"`

So names are:
- `agijob0.usdc-v092.alpha.jobs.agi.eth`
- `agijob1.usdc-v092.alpha.jobs.agi.eth`
- ...

Prefix changes apply only to unsnapshotted/future jobs. Already snapshotted labels stay unchanged.

---

## 4) Mainnet-sensitive warnings

- Mainnet deploy scripts require: `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`.
- `lockConfiguration()` on ENSJobPages is irreversible.
- Wiring the wrong ENSJobPages address into AGIJobManager changes hook target for all future calls.
- If the helper lacks root ownership or separately reviewed wrapper approval, create/adopt/write paths can fail best-effort.

---

## 5) Preconditions

- You control deployer key and owner key(s) needed for manual wiring.
- `hardhat/.env` is configured.
- You know the intended AGIJobManager address for `JOB_MANAGER`.
- `JOBS_ROOT_NAME` is explicitly reviewed. The deployment script rejects the legacy `alpha.jobs.agi.eth` root for a new mainnet USDC helper.
- The root owner is identified independently of the manager owner. At the qualification block they are different addresses.
- You have identified whether your jobs root is wrapped or unwrapped.

---

## 6) Exact deployment flow (mainnet)

Start in the repository root. Install both locked workspaces so the pinned compiler and its compatibility patches are available. Preserve an existing reviewed `hardhat/.env`; copy `.env.example` only when creating the initial configuration.

```bash
npm ci
cd hardhat
npm ci
npm run compile

export JOB_MANAGER='<verified-new-USDC-manager-address>'
export JOBS_ROOT_NAME='usdc-v092.alpha.jobs.agi.eth'
export NEW_OWNER='<reviewed-final-helper-owner-address>'

DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet

DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 LOCK_CONFIG=0 npm run deploy:ens-job-pages:mainnet
```

Required settings (via `.env` or the shell): `JOB_MANAGER` and `JOBS_ROOT_NAME`. The example also requires the reviewed final `NEW_OWNER`; an observed historical owner address is not proof of current signing access or the intended owner. `usdc-v092.alpha.jobs.agi.eth` is the tested proposal, not a pre-authorized live root. Verify authority and availability before adopting it.

Optional overrides:
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
- Performing only deployment, but failing to establish authority over the reviewed root.
- Establishing root authority, but forgetting the new manager’s `setEnsJobPages(newAddress)`.
- Treating broad NameWrapper approval as a default for a fresh USDC cutover.
- Locking configuration before validating at least one future job hook and any required legacy migration.
- Supplying an inexact `exactLabel` in legacy migration calls.

---

## 7) Required manual post-deploy wiring on mainnet

What is automated vs manual:
- Automated by deploy script: deploy contract, set `jobManager`, optional ownership transfer/verification.
- Manual on mainnet: establish the reviewed root authority, then call `setEnsJobPages` on the intended manager. A fresh USDC cutover leaves all legacy pointers and approvals unchanged.


### Step 1 — Establish authority over the reviewed root

For a fresh USDC deployment, the parent-root owner creates the dedicated child root with the new helper as its direct ENS Registry owner. The qualified fork exercises NameWrapper `setSubnodeOwner` on the observed wrapped parent; verify the parent, label, helper address, fuses and expiry for the actual transaction. Read `ENS.owner(jobsRootNode)` afterward and require the new helper address. No blanket NameWrapper approval is needed for this route.

For a separately reviewed replacement on the same manager with an existing wrapped jobs root, verify the helper owns that wrapped root or has the authority required by the wrapper. If operator approval is deliberately chosen, only its wrapped-root owner can call `setApprovalForAll(newEnsJobPages, true)`. This grants authority over **every wrapped name of that approving account**, so it is not a default cutover step. Record the scope and revocation plan. Do not transfer the original legacy manager’s root or revoke its helper authority to launch a new USDC manager.

### Step 2 — Point AGIJobManager to the new ENSJobPages
Caller: AGIJobManager owner account.

On AGIJobManager:
- `setEnsJobPages(newEnsJobPages)`

Why this matters:
- AGIJobManager calls ENS hooks on the configured `ensJobPages` target only.

Expected result after wiring:
- New hook calls route to the new ENSJobPages contract.
- On AGIJobManager `Read Contract`, `ensJobPages` equals `newEnsJobPages`.
- For the qualified dedicated-root route, ENS Registry `owner(jobsRootNode)` equals `newEnsJobPages`; for an intentionally reviewed wrapped-root replacement, the wrapper authority matches the approved plan.

---


## 7.1) Post-wiring expected checks (copy/paste checklist)

- [ ] AGIJobManager `ensJobPages()` equals `newEnsJobPages`.
- [ ] Root ownership/authority matches the dedicated-root or separately reviewed wrapped-root plan.
- [ ] Both manager/helper pointers and their separate owners match the intended configuration.
- [ ] The lifecycle transactions have successful receipts, and ENS hooks emit successful `ENSHookProcessed` events without skipped or best-effort failures.
- [ ] The job name and records exist; employer/agent resolver writes succeed while an outsider is rejected.
- [ ] After settlement, resolver delegation is revoked and further actor writes are rejected.
- [ ] The original manager’s jobs, balances, reserves, ENS pointer and records match the preserved legacy inventory.

A `status=1` settlement or an explicit ENS failure event alone does not pass wiring qualification. Investigate and rerun the affected lifecycle before declaring ENS operational.

## 8) Legacy migration for old wrapped job pages

This section applies only to existing pages of the **same manager** whose helper is being replaced. It must not be used to import the original mainnet manager’s pages into a fresh USDC manager. If such a page exists under a historical exact label, migrate by importing the exact label:

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

On ENS Registry (`Read Contract`), for the qualified dedicated-root route:
- `owner(jobsRootNode)` equals `newEnsJobPages`.

Only for a separately reviewed wrapped-root replacement, inspect NameWrapper ownership/authority against the approved plan. A blanket approval is not an unconditional success criterion.

On PublicResolver (`Read Contract`), through a full job lifecycle:
- `isApprovedFor(newEnsJobPages, jobNode, actor)` matches the intended employer/agent authorization before settlement and is false afterward. Confirm actual allowed and rejected writes, not just a successful core transaction.

Event checks:
- ENSJobPages deployment tx + ownership transfer (if used).
- AGIJobManager `EnsJobPagesUpdated(old,new)` event.

---

## 10) Rollback / recovery considerations

- If AGIJobManager was wired to the wrong ENSJobPages, owner can call `setEnsJobPages(previousAddress)` (if identity config still configurable).
- If NameWrapper authority is incorrect, establish authority over the intended dedicated root. `setApprovalForAll` applies to every wrapped name of the approving account; never grant broad authority merely to avoid resolving a root-owner mismatch.
- If legacy writes fail for specific jobs, run `migrateLegacyWrappedJobPage(jobId, exactLabel)` per affected job.
- If verification API fails, use deployment artifact `solc-input.json` for manual standard-json verify.

---

## 11) Operator “done successfully” checklist

- [ ] Dry run reviewed and approved.
- [ ] ENSJobPages deployed and (if required) verified.
- [ ] Dedicated-root ownership or separately reviewed wrapped-root authority verified.
- [ ] AGIJobManager `setEnsJobPages(new)` executed.
- [ ] Etherscan read checks pass on all key fields.
- [ ] Creation, actual delegated writes and terminal revocation pass without skipped/failed ENS hooks.
- [ ] Legacy jobs requiring migration identified and migrated.

## 12) Before locking ENSJobPages configuration

- [ ] All addresses (`ens`, `nameWrapper`, `publicResolver`, `jobManager`) are final.
- [ ] `jobsRootName`/`jobsRootNode` are final and validated.
- [ ] Reviewed root ownership/authority and the full ENS lifecycle already work.
- [ ] Migration backlog is complete or explicitly tracked.
- [ ] You acknowledge `lockConfiguration()` is irreversible.


## 13) Common mistakes (do not do this)

- Do not assume deploy scripts create the dedicated root or grant any wrapper authority.
- Do not grant broad NameWrapper authority merely to make a fresh USDC cutover appear wired.
- Do not forget `setEnsJobPages(newEnsJobPages)` on AGIJobManager owner account.
- Do not change prefix expecting old snapshotted labels to rename automatically.
- Do not lock configuration before validating future-job hooks and legacy-job migration needs.
- Do not treat ENS hook best-effort failures as proof that settlement failed; check AGIJobManager settlement events separately.


## 13.1) Migration-specific mistakes

- Calling `setEnsJobPages(new)` before reviewed root authority is in place, then misreading hook failures as total protocol failure.
- Locking ENSJobPages configuration before future-job hook validation and legacy migration checks.
- Using approximate labels for migration; `exactLabel` must match historical on-chain label.
