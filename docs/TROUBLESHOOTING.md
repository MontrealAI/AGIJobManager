# Troubleshooting (Operator-Focused)

This guide covers common deployment and ENS operations failures seen in current Hardhat + ENSJobPages workflows.

## 1) Hardhat compile import errors

### Symptom

Compile fails with missing imports (often OpenZeppelin).

### Likely cause

Dependencies were not installed in the `hardhat/` workspace.

### Recovery

```bash
cd hardhat
npm ci
npm run compile
```

Expected result:

- imports resolve and compile succeeds.

---

## 2) Missing OpenZeppelin dependency

### Symptom

Errors referencing `@openzeppelin/contracts/...` not found.

### Likely cause

`node_modules` missing or partial install.

### Recovery

- Reinstall with `npm ci` in the correct workspace (`hardhat/` for Hardhat scripts, repo root for Truffle tests).
- Avoid mixing partial installs between workspaces.

---

## 3) Mainnet deploy confirmation gate blocks execution

### Symptom

Script refuses deployment on chainId 1.

### Likely cause

Missing exact safety phrase env variable.

### Recovery

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

## 4) Verification failures (plugin/API)

### Symptom

Hardhat verify step fails or times out.

### Likely causes

- propagation delay after deploy,
- temporary Etherscan/API issue,
- env/API key misconfiguration.

### Recovery

1. Retry deployment verification after delay (`VERIFY_DELAY_MS`).
2. Use fallback manual verification with:
   - `hardhat/deployments/<network>/solc-input.json`
   - `hardhat/deployments/<network>/verify-targets.json`

Expected result:

- contract becomes verified via plugin or manual Standard JSON Input flow.

---

## 5) NameWrapper approval missing after ENSJobPages replacement

### Symptom

ENSJobPages cannot manage wrapped-root subnames; hooks report failures.

### Likely cause

Wrapped-root owner did not approve new ENSJobPages in NameWrapper.

### Recovery

On NameWrapper, wrapped-root owner calls:

- `setApprovalForAll(newEnsJobPages, true)`

Then confirm:

- `isApprovedForAll(wrappedRootOwner, newEnsJobPages) == true`

---

## 6) AGIJobManager still points to old ENSJobPages

### Symptom

New ENSJobPages was deployed, but hooks still target old contract.

### Likely cause

Manual post-deploy wiring step was skipped.

### Recovery

On AGIJobManager owner account call:

- `setEnsJobPages(newEnsJobPages)`

Then confirm AGIJobManager `ensJobPages()` returns expected new address.

---

## 7) Legacy write hooks fail (`JobLabelNotSnapshotted`)

### Symptom

Assign/completion/revoke/lock paths fail for older jobs in ENSJobPages.

### Likely cause

Job label was never snapshotted/imported in current ENSJobPages deployment.

### Recovery

Call legacy migration function with exact historical label:

- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

Note:

- label must match historical label exactly,
- wrapped-root flows require NameWrapper approval first.

---

## 8) Resolver/authorization writes fail but core protocol succeeds

### Symptom

ENS hook events indicate failures, but AGIJobManager lifecycle still progresses.

### Cause

Resolver and ENS updates in ENSJobPages are implemented as **best-effort** (`try/catch`) and intentionally non-fatal to escrow lifecycle.

### Recovery

- Inspect ENSJobPages events (`ENSHookBestEffortFailure`, `ENSHookSkipped`, `ENSHookProcessed`).
- Fix underlying resolver/ownership/approval conditions.
- Re-run specific corrective operations as needed (including manual migration for legacy labels).

---

## 9) How to inspect current config on Etherscan quickly

### AGIJobManager (Read Contract)

- `owner()`
- `ensJobPages()`
- identity config lock state getters (if present in your deployment ABI)

### ENSJobPages (Read Contract)

- `owner()`
- `jobManager()`
- `jobLabelPrefix()`
- `jobsRootName()`
- `jobsRootNode()`
- `configLocked()`

### NameWrapper (Read Contract)

- `ownerOf(uint256(jobsRootNode))`
- `isApprovedForAll(wrappedRootOwner, ensJobPages)`

Use these reads before and after any mainnet change to confirm expected wiring.
