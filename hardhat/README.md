# Hardhat Operator Guide (Official / Recommended)

This `hardhat/` project is the official deployment and verification workflow for AGIJobManager.

> Truffle remains supported as a legacy path. Hardhat is the recommended production path for new deployments and ENSJobPages replacement.

---

## 1) Scope and operational boundaries

### What this workflow does
- Compiles with pinned production-oriented settings from `hardhat.config.js` and deploy scripts.
- Deploys linked libraries and `AGIJobManager` via `scripts/deploy.js`.
- Deploys/replaces `ENSJobPages` via `scripts/deploy-ens-job-pages.js`.
- Attempts Etherscan verification.
- Writes deployment artifacts (`deployment.*.json`, `solc-input.json`, `verify-targets.json`) for audit trail and manual verification fallback.

### What this workflow intentionally does **not** do
- It does **not** automatically grant NameWrapper approval.
- It does **not** automatically call `AGIJobManager.setEnsJobPages(newEnsJobPages)`.
- It does **not** tune runtime owner settings after deployment.

Those are manual post-deploy wiring/operations steps.

---

## 2) Deployment paths in this repo

- **Official / recommended:** this `hardhat/` folder.
- **Legacy / supported:** root Truffle flow and docs under `../docs/DEPLOYMENT/`.

Legacy references:
- `../docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md`
- `../docs/DEPLOYMENT/TRUFFLE_MAINNET_DEPLOY.md`
- `../docs/DEPLOYMENT/TRUFFLE_PRODUCTION_DEPLOY.md`

---

## 3) Setup

```bash
cd hardhat
npm ci
cp .env.example .env
```

### Required `.env` keys
- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `DEPLOY_CONFIRM_MAINNET` (required on chainId 1)

### Common optional `.env` keys
- `FINAL_OWNER`
- `CONFIRMATIONS` (default `3`)
- `VERIFY_DELAY_MS` (default `3500`)
- `DRY_RUN=1`
- `DEPLOY_CONFIG` (override config file path)
- ENSJobPages script controls: `NEW_OWNER`, `VERIFY`, `LOCK_CONFIG`, `JOB_MANAGER`, `JOBS_ROOT_NAME`, `JOBS_ROOT_NODE`, `ENS_REGISTRY`, `NAME_WRAPPER`, `PUBLIC_RESOLVER`

Mainnet confirmation phrase (exact):

```text
I_UNDERSTAND_MAINNET_DEPLOYMENT
```

> ⚠️ Mainnet-sensitive: both deploy scripts hard-fail on chainId 1 unless `DEPLOY_CONFIRM_MAINNET` exactly matches this phrase.

---

## 4) AGIJobManager constructor profile source of truth

- Hardhat config: `hardhat.config.js`
- Default deploy profile: `deploy.config.example.js`
- Optional override: `DEPLOY_CONFIG=<path-to-js-config>`

`deploy.js` validates constructor args for shape and address/bytes32 format before broadcasting.

---

## 5) Compile

```bash
cd hardhat
npm run compile
```

Expected result:
- Compilation succeeds.
- Artifacts are written under `hardhat/artifacts`.

If you see OpenZeppelin import errors, run `npm ci` in this `hardhat/` directory (it is a separate Node project from repo root).

---

## 6) Dry-run (required before mainnet)

### AGIJobManager plan only
```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

### ENSJobPages plan only
```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet
```

Expected result:
- Script prints deploy plan and resolved parameters.
- Script exits before transactions are broadcast.

---

## 7) Mainnet deploy: AGIJobManager

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
- `UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership` deployed.
- `AGIJobManager` deployed.
- Verification attempts executed.
- `transferOwnership(finalOwner)` executed only if deployer differs from final owner.
- Deployment records written to `hardhat/deployments/mainnet/`.

### Keep these files (audit + fallback verification)
- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

---

## 8) Mainnet deploy: ENSJobPages (deploy or replacement)

Script: `scripts/deploy-ens-job-pages.js`

What the script performs:
- Deploys `ENSJobPages(ens, nameWrapper, publicResolver, jobsRootNode, jobsRootName)`.
- Calls `setJobManager(JOB_MANAGER)`.
- Optionally transfers ownership (`NEW_OWNER` or `FINAL_OWNER`).
- Optionally calls `lockConfiguration()` if `LOCK_CONFIG=1`.
- Optionally submits verification if `VERIFY=1`.

### Command sequence

```bash
cd hardhat
npm run compile
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:ens-job-pages:mainnet
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npm run deploy:ens-job-pages:mainnet
```

### Script defaults for mainnet context
- `ENS_REGISTRY`: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- `NAME_WRAPPER`: `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- `PUBLIC_RESOLVER`: `0xF29100983E058B709F3D539b0c765937B804AC15`
- `JOB_MANAGER`: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
- `JOBS_ROOT_NAME`: `alpha.jobs.agi.eth`

You may override these in `.env`. If setting `JOBS_ROOT_NODE`, it must match `namehash(JOBS_ROOT_NAME)` or the script reverts.

> ⚠️ Mainnet-sensitive: `LOCK_CONFIG=1` makes ENSJobPages config setters permanently unavailable.

---

## 9) Required manual post-deploy wiring (mainnet)

These are intentionally manual and should be confirmed in Etherscan.

1. **NameWrapper approval** (wrapped-root owner account):
   - `setApprovalForAll(newEnsJobPages, true)` on NameWrapper.
2. **Point AGIJobManager to new ENSJobPages** (AGIJobManager owner account):
   - `setEnsJobPages(newEnsJobPages)` on AGIJobManager.

Why this matters:
- Missing NameWrapper approval can block wrapped-root create/adopt/write paths.
- Missing `setEnsJobPages` means AGIJobManager still routes hooks to old ENSJobPages.

Expected result:
- Future hook calls target the new ENSJobPages.
- Wrapped-root operations are authorized.

Detailed runbook (including legacy migration):
- `../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`

---

## 10) Verification

### Automatic
Deploy scripts call `verify:verify` when configured.

### Manual fallback
Use artifact files from `hardhat/deployments/<network>/`:
- `solc-input.json` for standard-json verification.
- `verify-targets.json` for contract addresses/FQNs.

Troubleshooting reference:
- `../docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`

---

## 11) Etherscan read checks after deployment

### AGIJobManager
- `owner`
- `ensJobPages`

### ENSJobPages
- `owner`
- `ens`
- `nameWrapper`
- `publicResolver`
- `jobsRootName`
- `jobsRootNode`
- `jobManager`
- `jobLabelPrefix`
- `configLocked`

### NameWrapper
- `isApprovedForAll(rootOwner, newEnsJobPages)` (or token-level approval path)

---

## 12) Operator checklists

### Done successfully
- [ ] Dry-run output reviewed.
- [ ] Mainnet transactions mined.
- [ ] Verification succeeded or manual fallback documented.
- [ ] Deployment artifacts archived.
- [ ] (ENS replacement) NameWrapper approval granted.
- [ ] (ENS replacement) `AGIJobManager.setEnsJobPages(new)` completed.
- [ ] Etherscan read checks match expected values.

### Before locking ENSJobPages configuration
- [ ] `ens`, `nameWrapper`, `publicResolver` are correct.
- [ ] `jobsRootNode` and `jobsRootName` are correct and matching.
- [ ] `jobManager` is correct AGIJobManager address.
- [ ] NameWrapper approval is already in place for wrapped root.
- [ ] At least one create/write path was validated.
- [ ] You acknowledge `lockConfiguration()` is irreversible.
