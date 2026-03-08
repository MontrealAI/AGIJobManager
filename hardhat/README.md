# Hardhat Deployment & Verification Guide (Official / Recommended)

This `hardhat/` workspace is the official deployment flow for AGIJobManager.

It covers:

1. deterministic compile,
2. dry-run planning,
3. deployment of AGIJobManager + linked libraries,
4. verification,
5. optional ownership transfer,
6. additive ENSJobPages deployment/replacement utility.

It does **not** perform protocol tuning or governance operations after deployment.

---

## 1) Recommended vs legacy deployment paths

- **Recommended path:** this Hardhat workflow.
- **Legacy-supported path:** Truffle migrations (`../migrations`) and docs in `../docs/DEPLOYMENT/*TRUFFLE*`.

Why this matters: operators should use one path consistently per operation record, and auditors should be explicit about which path produced each deployed address.

---

## 2) What the official AGIJobManager deploy script does

Script: `hardhat/scripts/deploy.js`

On `deploy:mainnet` or `deploy:sepolia`, it:

1. validates environment and deployment profile,
2. deploys 5 libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`),
3. deploys `AGIJobManager` with constructor args from deploy config,
4. attempts Etherscan verification (with retries),
5. runs `transferOwnership(finalOwner)` if deployer differs,
6. writes deployment receipts/artifacts under `hardhat/deployments/<network>/`.

It does **not** run post-deploy parameter changes (no pause toggles, no ENSJobPages wiring, no root updates, no manual ops actions).

---

## 3) Environment setup

```bash
cd hardhat
npm ci
cp .env.example .env
```

Required `.env` keys for normal deployment:

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`

Common optional keys:

- `FINAL_OWNER` (defaults to `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201`)
- `DEPLOY_CONFIG` (custom config path; default is `deploy.config.example.js`)
- `CONFIRMATIONS` (default `3`)
- `VERIFY_DELAY_MS` (default `3500`)
- `DRY_RUN=1` (plan only; no transactions)

Mainnet gate:

- `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`

> ⚠️ **Mainnet-sensitive:** chainId `1` deployments are blocked unless the exact confirmation phrase is provided.

---

## 4) Compile

```bash
cd hardhat
npm run compile
```

Expected result:

- Hardhat compiles all contracts without import errors.
- Build info is written under `hardhat/artifacts/build-info/`.

---

## 5) Dry-run plan (no on-chain writes)

### Sepolia

```bash
cd hardhat
DRY_RUN=1 npm run deploy:sepolia
```

### Mainnet

```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Expected result:

- Console prints a `=== Deployment Plan ===` JSON payload.
- Script exits before sending transactions.

---

## 6) Deploy AGIJobManager (official flow)

### Mainnet

```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Optional owner override:

```bash
cd hardhat
FINAL_OWNER=0xYourOwner DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

### Sepolia

```bash
cd hardhat
npm run deploy:sepolia
```

Expected result:

- 5 libraries + `AGIJobManager` are deployed.
- Verification attempts run automatically.
- Ownership transfer executes if deployer != final owner.
- Receipt file appears in `hardhat/deployments/<network>/deployment.<chainId>.<block>.json`.

---

## 7) ENSJobPages deploy/replacement utility (additive)

Script: `hardhat/scripts/deploy-ens-job-pages.js`

This is an **additive utility**. It does not replace `deploy.js`.

### Compile first

```bash
cd hardhat
npm run compile
```

### Mainnet dry-run

```bash
cd hardhat
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet
```

### Mainnet deploy + verify attempt

```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT VERIFY=1 NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet
```

Key env overrides accepted by the script:

- `JOB_MANAGER`
- `JOBS_ROOT_NAME`
- `JOBS_ROOT_NODE` (must match namehash of `JOBS_ROOT_NAME`)
- `ENS_REGISTRY`
- `NAME_WRAPPER`
- `PUBLIC_RESOLVER`
- `LOCK_CONFIG=1` (optional; locks ENSJobPages config)

Expected result:

- New ENSJobPages address is printed.
- `setJobManager(jobManager)` is executed.
- Optional verify/lock/ownership transfer are attempted if configured.

---

## 8) Manual post-deploy wiring (required for ENSJobPages replacement)

After deploying a replacement ENSJobPages on mainnet, run these manually (typically via Etherscan):

1. On **NameWrapper** (wrapped-root owner account):
   - `setApprovalForAll(newEnsJobPages, true)`
2. On **AGIJobManager** (contract owner account):
   - `setEnsJobPages(newEnsJobPages)`

Why this matters:

- Without NameWrapper approval, wrapped-root subname operations can fail authorization checks in ENSJobPages.
- Without `setEnsJobPages`, AGIJobManager continues sending hooks to the old ENSJobPages address.

Expected result:

- NameWrapper approvals show `isApprovedForAll(owner, newEnsJobPages) == true`.
- AGIJobManager `ensJobPages()` resolves to the new address.

---

## 9) Verification artifacts and fallback workflow

For each official deploy run, artifacts are written to:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

Use `solc-input.json` and addresses from `verify-targets.json` for manual Etherscan Standard JSON Input verification if plugin/API verification fails.

---

## 10) Operational checklists

### Done successfully checklist

- [ ] Compile passes.
- [ ] Dry-run plan reviewed and archived.
- [ ] Deployment txs mined with expected addresses.
- [ ] Verification is `verified` or `already_verified` (or manually completed).
- [ ] `finalOwner` is correct.
- [ ] (If ENSJobPages replacement) NameWrapper approval set.
- [ ] (If ENSJobPages replacement) AGIJobManager `setEnsJobPages` set to new address.

### Before locking configuration (`LOCK_CONFIG=1` or `lockConfiguration()`)

- [ ] Confirm `ens`, `nameWrapper`, `publicResolver`, `jobsRootNode`, `jobsRootName`, and `jobManager` are final.
- [ ] Confirm wrapped root ownership/approval is stable.
- [ ] Confirm post-deploy manual wiring is complete.
- [ ] Confirm operators have tested at least one job flow using the new ENSJobPages.

> ⚠️ **Mainnet-sensitive / hard to undo:** locking config is intended to be permanent operational hardening. Validate all addresses first.

---

## 11) Troubleshooting highlights

- Hardhat compile import error for OpenZeppelin:
  - run `npm ci` inside `hardhat/`; dependency is declared in `hardhat/package.json`.
- Mainnet deploy blocked:
  - add exact `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`.
- Verification failures:
  - retry after delay; then use `deployments/<network>/solc-input.json` manual verification path.
- ENS operations failing after ENSJobPages replacement:
  - check NameWrapper `setApprovalForAll` and AGIJobManager `setEnsJobPages` wiring.

For expanded operator troubleshooting, see [`../docs/TROUBLESHOOTING.md`](../docs/TROUBLESHOOTING.md).

---

## 12) Related documents

- Deployment index: [`../docs/DEPLOYMENT/README.md`](../docs/DEPLOYMENT/README.md)
- ENSJobPages mainnet replacement runbook: [`../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`](../docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- ENS naming behavior: [`../docs/ENS/ENS_JOB_PAGES_OVERVIEW.md`](../docs/ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Legacy Truffle deployment docs: [`../docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md`](../docs/DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
