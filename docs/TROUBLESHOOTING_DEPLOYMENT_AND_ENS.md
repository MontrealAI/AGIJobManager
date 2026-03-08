# Troubleshooting: Hardhat Deployment and ENSJobPages Operations

This guide covers common production/operator issues for the current Hardhat + ENSJobPages workflow.

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
