# Troubleshooting: Hardhat Deployment and ENSJobPages Operations

This guide covers common operator failures for the current Hardhat deployment flow and ENSJobPages mainnet operations.

---

## 1) Hardhat compile import errors

### Symptom
`File import callback not supported`, `Source "@openzeppelin/contracts/..." not found`, or similar compile failures.

### Cause
Dependencies were not installed in the same Node project where compile was run.

### Fix
```bash
cd hardhat
npm ci
npm run compile
```

If you are using root Truffle flow instead:
```bash
cd /workspace/AGIJobManager
npm ci
npm run build
```

Expected result:
- Compile completes and artifacts are generated.

---

## 2) Missing OpenZeppelin dependency

### Symptom
`Cannot find module '@openzeppelin/contracts'` or Solidity imports fail.

### Cause
`hardhat/` and repo root are separate package contexts.

### Fix
```bash
# Hardhat project
cd hardhat && npm ci

# Root project
cd /workspace/AGIJobManager && npm ci
```

---

## 3) Mainnet deploy blocked by confirmation gate

### Symptom
Deployment script exits with refusal message on chainId 1.

### Cause
`DEPLOY_CONFIRM_MAINNET` not set to exact required phrase.

### Fix
```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Same gate applies to:
```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet
```

---

## 4) Verification failures

### Symptom
Hardhat verification fails, times out, or returns temporary explorer errors.

### Checks
- `ETHERSCAN_API_KEY` present.
- Correct network endpoint.
- Contract addresses and constructor args from deployment output.

### Recovery
- Increase delay:
  - `VERIFY_DELAY_MS=7000`
- Retry with same deployed addresses where possible.
- Use manual fallback artifacts:
  - `hardhat/deployments/<network>/solc-input.json`
  - `hardhat/deployments/<network>/verify-targets.json`

---

## 5) NameWrapper approval missing (wrapped root)

### Symptom
Wrapped subname create/adopt/update paths fail or partially fail.

### Cause
Wrapped-root owner did not approve ENSJobPages as operator.

### Fix
On NameWrapper (wrapped-root owner account):
- `setApprovalForAll(newEnsJobPages, true)`

Verification:
- `isApprovedForAll(rootOwner, newEnsJobPages) == true`

---

## 6) AGIJobManager still points to old ENSJobPages

### Symptom
New ENSJobPages is deployed but hooks still hit old contract.

### Cause
Manual post-deploy wiring not performed.

### Fix
On AGIJobManager (owner account):
- `setEnsJobPages(newEnsJobPages)`

Verification:
- `ensJobPages` getter returns `newEnsJobPages`.

---

## 7) Legacy write hooks failing (`JobLabelNotSnapshotted`)

### Symptom
Write paths for old jobs fail because label was never snapshotted in current ENSJobPages.

### Fix
On ENSJobPages (owner account):
- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

Requirements:
- `exactLabel` must exactly match historical label for the specific job.

Verification:
- `jobLabelSnapshot(jobId)` returns `(true, exactLabel)`.
- Migration event `LegacyJobPageMigrated(...)` exists.

---

## 8) Resolver/auth updates fail but AGIJobManager continues

### Symptom
Lifecycle progressed, but ENS resolver text/auth state is missing or stale.

### Explanation
ENS hook operations are best-effort by design and should not halt core settlement.

### What to inspect
On ENSJobPages events:
- `ENSHookProcessed`
- `ENSHookSkipped`
- `ENSHookBestEffortFailure`

### Recovery actions
- Confirm `ens`, `nameWrapper`, `publicResolver`, `jobsRootNode`, `jobsRootName`, `jobManager`.
- Confirm NameWrapper approval for wrapped root.
- Re-run safe owner/manual correction path as appropriate.

---

## 9) Inspect current on-chain config via Etherscan

### AGIJobManager (`Read Contract`)
- `owner`
- `ensJobPages`
- `useEnsJobTokenURI`

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
- `isApprovedForAll(rootOwner, ensJobPages)` for wrapped root operations.

---

## 10) Cross references

- Official Hardhat operator guide: `../hardhat/README.md`
- ENS replacement runbook: `DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- ENS behavior reference: `ENS/ENS_JOB_PAGES_OVERVIEW.md`
