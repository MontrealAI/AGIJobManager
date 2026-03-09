# Troubleshooting: Hardhat Deployment and ENSJobPages Operations

This guide covers common production/operator issues for the current Hardhat + ENSJobPages workflow.


## Do-not-do-this-first response
Before deeper debugging, do **not** immediately redeploy again. First verify:
1. `AGIJobManager.ensJobPages()` points to intended contract.
2. NameWrapper approval exists for that exact ENSJobPages address.
3. The failing job is legacy and may need `migrateLegacyWrappedJobPage`.


## Why old create/write hooks failed in replacement scenarios

Most historical failures were one (or more) of these:
1. AGIJobManager still pointed to old ENSJobPages.
2. NameWrapper approval was missing for the active ENSJobPages.
3. Legacy job label was not snapshotted in the new ENSJobPages yet.

This is why the canonical cutover order is strict: deploy -> wrapper approval -> `setEnsJobPages` -> legacy migration as needed -> lock only after validation.

## Quick triage by symptom
Expected triage outcome: identify whether the issue is pointer wiring, wrapper approval, or legacy label snapshot state before any new deployment attempt.

- New ENSJobPages deployed but no effect: check AGIJobManager `setEnsJobPages(newAddress)` was executed.
- Wrapped root writes failing: check NameWrapper approval for active ENSJobPages.
- Legacy jobs failing post-create writes: migrate exact labels with `migrateLegacyWrappedJobPage`.
- Settlement succeeded but ENS update missing: expected under best-effort ENS semantics; inspect ENS hook events.

## Safety preflight before any cutover tx
- [ ] Confirm which account is **AGIJobManager owner**.
- [ ] Confirm which account is **wrapped-root owner**.
- [ ] Confirm manual steps are scheduled (NameWrapper approval + `setEnsJobPages`).
- [ ] Confirm legacy jobs likely to need migration are listed.

---

## 1) Hardhat compile import errors

### Symptom
Errors such as missing `@openzeppelin/contracts/...` imports.

### Cause
Dependencies not installed in the **same project** where command is run.

### Fix
```bash
cd hardhat
npm ci
npm run compile
```

If using root Truffle flow instead:
```bash
cd /workspace/AGIJobManager
npm ci
npm run build
```

---

## 2) Missing OpenZeppelin dependency

### Symptom
`Cannot find module '@openzeppelin/contracts'` or Solidity import not found.

### Fix
Install with lockfile-respecting command in current subproject:

```bash
# Hardhat project
cd hardhat && npm ci

# Root project (Truffle/tests/docs tooling)
cd /workspace/AGIJobManager && npm ci
```

Why this happens:
- `hardhat/` has its own `package.json` and `node_modules`.

---

## 3) Mainnet deployment blocked by confirmation gate

### Symptom
Error refusing mainnet deployment due to missing confirmation phrase.

### Fix
Use exact value:

```bash
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT
```

Example:
```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

---

## 4) Verification failures

### Symptom
Hardhat verify step fails or times out.

### Checks
- `ETHERSCAN_API_KEY` set.
- Correct network RPC and chain.
- Sufficient block confirmations elapsed.

### Fixes
- Increase delay and retry deployment script:
  - `VERIFY_DELAY_MS=7000`
- Use saved artifacts for manual standard-json verification:
  - `hardhat/deployments/<network>/solc-input.json`
  - `hardhat/deployments/<network>/verify-targets.json`

---

## 5) NameWrapper approval missing (wrapped root)

### Symptom
ENSJobPages cannot create/adopt/manage wrapped subnames reliably.

### Cause
Wrapped-root owner did not grant NameWrapper approval to new ENSJobPages.

### Fix
On NameWrapper, wrapped-root owner calls:
- `setApprovalForAll(newEnsJobPages, true)`

Confirm in Etherscan `Read Contract`:
- `isApprovedForAll(rootOwner, newEnsJobPages) == true`

---

## 6) AGIJobManager still points to old ENSJobPages

### Symptom
New ENSJobPages deployed, but hooks still go to old contract.

### Cause
Manual post-deploy wiring step not completed.

### Fix
On AGIJobManager (owner account):
- `setEnsJobPages(newEnsJobPages)`

Confirm in Etherscan `Read Contract`:
- `ensJobPages == newEnsJobPages`

---

## 7) Legacy job write hooks fail (label not snapshotted)

### Symptom
Post-create writes fail for old jobs, often due to `JobLabelNotSnapshotted` semantics in ENSJobPages.

### Cause
Job label for that legacy job was never imported/snapshotted in current ENSJobPages.

### Fix
On ENSJobPages owner account call:
- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

`exactLabel` must exactly match the historical label for that job id.

Confirm with:
- `jobLabelSnapshot(jobId)` returns `(true, "...")`.

---

## 8) Resolver/authorization updates fail but protocol continues

### Symptom
ENS metadata or resolver authorization is missing/incomplete, but AGIJobManager lifecycle progressed.

### Explanation
ENS updates are implemented as best-effort; hook and resolver operations can fail without reverting the core protocol flow.

### Operator action
- Inspect ENSJobPages events:
  - `ENSHookBestEffortFailure`
  - `ENSHookSkipped`
  - `ENSHookProcessed`
- Correct config (resolver address, wrapper approval, ownership/wiring), then retry owner/manual helper paths if appropriate.

---

## 9) How to inspect current config on Etherscan

### AGIJobManager (`Read Contract`)
- `owner`
- `ensJobPages`
- `useEnsJobTokenURI`
- ENS root-related fields and identity lock status as applicable

### ENSJobPages (`Read Contract`)
- `owner`
- `ens`
- `nameWrapper`
- `publicResolver`
- `jobsRootName`
- `jobsRootNode`
- `jobManager`
- `jobLabelPrefix`
- `configLocked`

### NameWrapper (`Read Contract`)
- approval status for ENSJobPages operator
- wrapped ownership of `jobsRootNode` token id

---

## 10) Cross-references

- Official Hardhat guide: `../hardhat/README.md`
- ENS replacement runbook: `DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- ENS behavior overview: `ENS/ENS_JOB_PAGES_OVERVIEW.md`


## 11) FAQ-style operator clarifications

### Why did Etherscan show an ENS-path revert but the transaction still succeeded?
ENS hook operations are designed as best-effort side effects. AGIJobManager can continue core settlement while ENSJobPages emits hook failure/skip events for recoverable ENS issues.

### Why can settlement succeed while ENS fails?
Protocol escrow settlement is intentionally decoupled from ENS writes so metadata outages do not block payouts/dispute outcomes.

### Why do some jobs use `agijob...` and others `job-...`?
Legacy jobs may carry previously snapshotted historical labels. Prefix changes only affect unsnapshotted/future jobs in the current ENSJobPages context.

### What should I check before calling `lockConfiguration()`?
Confirm final addresses, wrapper approvals, AGIJobManager wiring, and any required legacy migrations. Lock only after successful end-to-end validation.

### What should I do if post-create ENS writes fail after cutover?
Check wrapper approval and AGIJobManager wiring first, then migrate affected legacy jobs with exact historical labels where needed.

## 11) Using the standalone HTML UI during triage

If you are validating live mainnet behavior through the versioned standalone page (`ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`), use the dedicated troubleshooting section in:
- `docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md`

Keep deployment/cutover troubleshooting in this document as canonical for pointer wiring, NameWrapper approval, and legacy migration decisions.
