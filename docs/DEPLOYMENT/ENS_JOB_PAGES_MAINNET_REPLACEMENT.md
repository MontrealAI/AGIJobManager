# ENSJobPages Mainnet Replacement Runbook

This runbook replaces `ENSJobPages` for the **same, verified USDC manager**. Use explicit replacement mode to preserve its existing root and names. For a fresh manager, follow the [deployment namespace policy](../ENS/DEPLOYMENT_NAMESPACES.md) and [USDC cutover preservation plan](../qualification/USDC_CUTOVER.md): deploy a separate helper and namespace, and preserve every historical manager's ENS wiring and original-asset exits.

## In one minute

Canonical cutover flow:
1. Deploy new `ENSJobPages` (Hardhat script).
2. Establish the new helper’s ownership of the dedicated wrapped jobs-root token, as qualified below. Any broader NameWrapper operator approval is a separate same-manager replacement decision.
3. AGIJobManager owner manually calls `AGIJobManager.setEnsJobPages(newEnsJobPages)`.
4. For existing jobs of this same manager only, migrate historical page labels if needed (`migrateLegacyWrappedJobPage`). Never import the original mainnet manager’s pages or balances into a fresh USDC manager.
5. Lock configuration only after validation is complete.

---

## 1.1) Who does which action

| Action | Automated by script? | Required caller |
| --- | --- | --- |
| Deploy new `ENSJobPages` | Yes | deployer key |
| `setJobManager(JOB_MANAGER)` on new ENSJobPages | Yes | deployer key |
| Preserve existing `jobLabelPrefix` on replacement; set `job-` on fresh setup | Yes | deployer key |
| Establish dedicated-root ownership by the new helper | No (manual) | ENS parent owner |
| Broader NameWrapper approval, only for a separately reviewed same-manager wrapped-root replacement | No (manual) | wrapped-root owner |
| `AGIJobManager.setEnsJobPages(newEnsJobPages)` | No (manual) | AGIJobManager owner |
| `migrateLegacyWrappedJobPage(jobId, exactLabel)` | No (manual, if needed) | ENSJobPages owner |
| `lockConfiguration()` | Optional/manual | ENSJobPages owner |

---

## 1) Purpose and scope

`ENSJobPages` manages ENS job page naming and metadata writes for AGIJobManager hooks.

It determines:
- job label prefix (`jobLabelPrefix`, preserved from the replaced helper),
- job root suffix (`jobsRootName`, also preserved on replacement; derived for fresh setup),
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


A replacement keeps the existing root and default prefix. Read each historical job's exact label from the old helper; a current prefix is insufficient to reconstruct saved names. Fresh setup instead uses `job-<jobId>.usdc-<chainId>-<full-lowercase-manager-address-without-0x>.<parent>`. See the [namespace guide](../ENS/DEPLOYMENT_NAMESPACES.md) for concrete examples and the historical deployment catalog.

Prefix changes apply only to unsnapshotted/future jobs. Already snapshotted labels stay unchanged across prefix changes, but a mutable global root is not frozen by those label snapshots.

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
- You know the intended verified USDC manager address for `JOB_MANAGER`. Keep its intake paused and complete any pending manager ownership acceptance before helper deployment. Independently compare `owner()` with the intended owner in the reviewed manager receipt: the helper preflight’s zero `pendingOwner()` check alone cannot prove the intended handover occurred.
- Set `ENS_DEPLOYMENT_MODE=replacement` and `REPLACES_ENS_JOB_PAGES` to the manager's current helper. Its manager and registry must match. The tool reads and preserves its root and prefix; optional `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE` and `JOB_LABEL_PREFIX` are assertions, not rename requests. Leave `JOBS_PARENT_NAME` unset.
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

export JOB_MANAGER='<verified-existing-USDC-manager-address>'
export ENS_DEPLOYMENT_MODE=replacement
export REPLACES_ENS_JOB_PAGES='<current-helper-address>'
export NEW_OWNER='<reviewed-final-helper-owner-address>'

DRY_RUN=1 npm run deploy:ens-job-pages:mainnet

DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 LOCK_CONFIG=0 npm run deploy:ens-job-pages:mainnet
```

Required replacement settings (via `.env` or the shell): `JOB_MANAGER`, `ENS_DEPLOYMENT_MODE=replacement`, `REPLACES_ENS_JOB_PAGES` and the explicit final helper owner (`NEW_OWNER` or `FINAL_OWNER`). The example uses `NEW_OWNER`; an observed historical owner address is not proof of current signing access or the intended owner. Remove any fresh-mode `JOBS_PARENT_NAME` from both the shell and `.env`. Review the preserved namespace in the printed plan before deployment.

For a **fresh** manager, use `ENS_DEPLOYMENT_MODE=fresh`, omit `REPLACES_ENS_JOB_PAGES` and follow the [fresh setup steps](../ENS/DEPLOYMENT_NAMESPACES.md#fresh-deployment-what-the-operator-does). Mainnet defaults the parent to `alpha.jobs.agi.eth`; other networks require an explicit `JOBS_PARENT_NAME`. The root is derived automatically, must be unused, and is rechecked before deployment. Fresh mode requires no existing helper and no allocated job IDs.

Read-only planning needs a deployer address (`DEPLOYER_ADDRESS` when no key is configured), but no signing key, mainnet confirmation phrase or explorer API key. Public-network broadcasts require explorer verification; `VERIFY` defaults enabled and disabling it blocks the broadcast. Keep `LOCK_CONFIG=0` until actual wiring and the complete ENS lifecycle have been validated.

Review mainnet address overrides for `ENS_REGISTRY`, `NAME_WRAPPER` and `PUBLIC_RESOLVER`, and any `JOBS_ROOT_NODE` override, which must equal the root namehash. Sepolia has no copied mainnet defaults for those ENS addresses: set all three explicitly, using zero NameWrapper only for an intentionally unwrapped configuration. Both public networks require paused manager intake and zero pending owner; existing reserves do not by themselves block a separately reviewed same-manager helper replacement.

Expected result:
- New ENSJobPages address deployed.
- `setJobManager(JOB_MANAGER)` already executed by script.
- Root and prefix read back exactly as recorded in the namespace plan; a differing constructor prefix is updated by the script.
- Exact runtime matched against the qualified artifact; journal and its `solcInputPath` compiler input preserved.
- Explorer verification completed successfully before the one-step helper ownership transfer.
- Final helper owner, manager pointer and unlocked configuration match the reviewed plan.


### Common cutover mistakes
- Performing only deployment, but failing to establish authority over the reviewed root.
- Establishing root authority, but forgetting the new manager’s `setEnsJobPages(newAddress)`.
- Treating broad NameWrapper approval as a default for a fresh USDC cutover.
- Locking configuration before validating at least one future job hook and any required legacy migration.
- Supplying an inexact `exactLabel` in legacy migration calls.

---

## 7) Required manual post-deploy wiring on mainnet

What is automated vs manual:
- Automated by deploy script: check namespace, deploy contract, check runtime, set `jobManager` and the planned prefix, complete required verification, transfer ownership to the explicit final helper owner and optionally lock only if requested. Keep deployment-time locking disabled.
- Manual on mainnet: establish the reviewed root authority, then call `setEnsJobPages` on the intended manager. A fresh USDC cutover leaves all legacy pointers and approvals unchanged.


### Step 1 — Establish authority over the reviewed root

For a fresh USDC deployment, the parent-root owner creates the dedicated child root using NameWrapper `setSubnodeOwner`, with the new helper as owner of the **wrapped root token**. Verify the parent, label, helper address, fuses and expiry for the actual transaction. The qualified fork asserts `ENS.owner(jobsRootNode) == NameWrapper` and `NameWrapper.ownerOf(uint256(jobsRootNode)) == newEnsJobPages`; `getData(root)[0]` agrees. The helper is not the direct ENS Registry owner in this route. Token approval is zero and the parent owner has not granted the helper blanket operator approval. No new blanket approval is needed.

A directly owned **unwrapped** root is a separate supported configuration: its ENS Registry owner must be the helper. It is not the route exercised by the dedicated wrapped-root fixture. For a separately reviewed replacement on the same manager with an existing wrapped jobs root, verify the helper owns that wrapped token or has the authority required by the wrapper. If operator approval is deliberately chosen, only its wrapped-root owner can call `setApprovalForAll(newEnsJobPages, true)`. This grants authority over **every wrapped name of that approving account**, so it is not a default cutover step. Record the scope and revocation plan. Do not transfer the original legacy manager’s root or revoke its helper authority to launch a new USDC manager.

### Step 2 — Point AGIJobManager to the new ENSJobPages
Caller: AGIJobManager owner account.

On AGIJobManager:
- `setEnsJobPages(newEnsJobPages)`

Why this matters:
- AGIJobManager calls ENS hooks on the configured `ensJobPages` target only.

Expected result after wiring:
- New hook calls route to the new ENSJobPages contract.
- On AGIJobManager `Read Contract`, `ensJobPages` equals `newEnsJobPages`.
- For the qualified dedicated wrapped-root route, Registry `owner(jobsRootNode)` equals NameWrapper and `NameWrapper.ownerOf(uint256(jobsRootNode))` equals `newEnsJobPages`. Any separately reviewed authority configuration matches its approved plan.

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

- **Future/unsnapshotted jobs:** new creates use `<prefix><jobId>.<jobsRootName>` with the preserved default prefix and root, and should proceed once wiring is complete.
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

For the qualified dedicated wrapped-root route, check:
- ENS Registry `owner(jobsRootNode)` equals the configured NameWrapper.
- NameWrapper `ownerOf(uint256(jobsRootNode))` and `getData(jobsRootNode)[0]` equal `newEnsJobPages`.
- Token approval is zero and `isApprovedForAll(parentOwner,newEnsJobPages)` is false. The helper owns its own dedicated token and needs no blanket authority over the parent owner’s other names.

A separately reviewed unwrapped-root configuration instead requires Registry owner equal to the helper. A blanket approval is not an unconditional success criterion for either route.

On PublicResolver (`Read Contract`), through a full job lifecycle:
- `isApprovedFor(newEnsJobPages, jobNode, actor)` matches the intended employer/agent authorization before settlement and is false afterward. Confirm actual allowed and rejected writes, not just a successful core transaction.

Event checks:
- ENSJobPages deployment transaction and one-step transfer to the reviewed final owner.
- AGIJobManager `EnsJobPagesUpdated(old,new)` event.

---

## 10) Rollback / recovery considerations

- If AGIJobManager was wired to the wrong ENSJobPages, owner can call `setEnsJobPages(previousAddress)` (if identity config still configurable).
- If NameWrapper authority is incorrect, establish authority over the intended dedicated root. `setApprovalForAll` applies to every wrapped name of the approving account; never grant broad authority merely to avoid resolving a root-owner mismatch.
- If legacy writes fail for specific jobs, run `migrateLegacyWrappedJobPage(jobId, exactLabel)` per affected job.
- If helper verification fails, use the specific manual procedure below. `reverify:mainnet` and `reverify:sepolia` recover manager deployments only; they do not accept ENS helper journals.

---

### Recover helper verification without redeploying

1. Preserve the failed `ens-job-pages.<chain>.<id>.json` journal, the compiler input at its `solcInputPath`, and all transaction receipts. Reconcile the deployment address and successful transactions against the selected chain. Read current helper `owner()`, `jobManager()`, `jobsRootName()`, `jobsRootNode()`, `jobLabelPrefix()` and `configLocked()`; a failed command may already have deployed or partly configured the helper. Compare the namespace to the saved plan.
2. Check the deployed runtime against the qualified artifact and the journal’s `expectedRuntimeCodeHash`/`runtimeCodeHash`. A mismatch requires investigation; do not submit different source merely to obtain a verification badge.
3. On the correct explorer’s source-verification form, select Solidity Standard-JSON input and the exact release compiler **0.8.37**. Upload the unchanged input referenced by `solcInputPath`; it already contains optimizer, IR, EVM and metadata settings. Select `contracts/ens/ENSJobPages.sol:ENSJobPages` if the form requests the contract name. Use the original five constructor arguments from `constructorArgs`. If ABI-encoded arguments are required, derive them read-only from `hardhat/`:

```bash
ENS_DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-ens-journal>.json node - <<'NODE'
const fs = require("node:fs");
const { AbiCoder } = require("ethers");
const journal = JSON.parse(fs.readFileSync(process.env.ENS_DEPLOYMENT_RECEIPT, "utf8"));
console.log(AbiCoder.defaultAbiCoder().encode(
  ["address", "address", "address", "bytes32", "string"],
  journal.constructorArgs
).slice(2));
NODE
```

4. Save the explorer result and a separate recovery record identifying the original journal, exact source/compiler input and verified address. Preserve the original failed journal; do not rewrite its status into a synthetic successful deployment. No blockchain transaction is needed for explorer verification.
5. Only after successful verification, review which intended owner actions are still missing. The current helper owner performs only those actions, such as `setJobManager`, `setJobLabelPrefix` with the journal's planned prefix, or the one-step `transferOwnership` to the reviewed final helper owner. Re-read the actual state and reconcile each receipt. Keep configuration unlocked until root authority, both pointers, delegated writes and terminal revocation are validated. Do not rerun the deployment command to resume these actions.

## 11) Operator “done successfully” checklist

- [ ] Dry run reviewed and approved.
- [ ] ENSJobPages deployed, exact runtime matched and source verified.
- [ ] Helper owner equals the explicit reviewed final owner; manager owner independently matches its reviewed receipt.
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
