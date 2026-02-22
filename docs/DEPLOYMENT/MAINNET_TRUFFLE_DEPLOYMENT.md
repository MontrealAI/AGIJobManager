# Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle Migrations)

## 1) Executive Summary

This guide is the production runbook for deploying AGIJobManager to Ethereum mainnet with this repository’s Truffle migration flow, verifying contracts on Etherscan, and transferring ownership to the final owner safely.

### What is being deployed

Mainnet deployment in this repository means:
- deploying linked Solidity libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`), then
- deploying `AGIJobManager` with constructor arguments from the production operator config, then
- applying post-deploy owner actions encoded in migration #6.

### Critical intended-use policy (prominent)

AGIJobManager is intended for **autonomous AI agents exclusively** as protocol participants. Humans are supervisors/operators/owners.

The authoritative Terms & Conditions text is in the header comment of `contracts/AGIJobManager.sol`. This guide is operational guidance only. For legal authority, review the contract source directly and the legal authority note in `docs/LEGAL/TERMS_AND_CONDITIONS.md`.

### Owner vs Operator responsibilities

- **Owner (decision authority):** approves risk posture, configuration values, final ownership address, and go-live readiness.
- **Operator (execution authority):** runs commands, controls deployer key, captures artifacts, performs verification, and executes approved transfer steps.

### Highest-risk irreversible mistakes

1. Deploying to the wrong chain or wrong migration range.
2. Using an unapproved owner address (especially for `transferOwnership`).
3. Applying incorrect identity/ENS/token config and then locking identity configuration.
4. Verifying with wrong compiler/optimizer/library/constructor settings (auditability failure).
5. Proceeding without preserving the deterministic deployment receipt.

---

## 2) Pre-Deployment Decisions (Owner checklist)

Complete this checklist before any mainnet transaction.

- [ ] **Final owner address approved** (recommended: multisig).
  - Deployer EOA may be temporary; final owner should be a separately reviewed destination.
- [ ] **RPC provider approach approved**.
  - Decide redundancy, rate limits, and incident fallback; do not rely on a single endpoint without contingency.
- [ ] **Gas strategy approved (EIP-1559 basics)**.
  - Decide replacement/nonce policy and max-fee boundaries. Do not rely on fixed price predictions.
- [ ] **Token address approved**.
  - Legacy default — verify: AGIALPHA ERC-20 `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.
- [ ] **ENS features choice approved (enable now vs neutral/disabled now)**.
  - ENS settings affect identity authorization paths and future governance options.
- [ ] **Allowlisting model approved**.
  - Decide between additional address lists, Merkle roots, and ENS-ownership gating.
- [ ] **Identity configuration lock policy approved**.
  - `lockIdentityConfiguration()` is one-way. Approve timing explicitly.
- [ ] **Legacy defaults policy approved**.
  - Policy: start from legacy contract values as a suggested baseline, then approve deviations.

### Legacy defaults — verify (suggested starting point, not truth source)

Reference legacy mainnet AGIJobManager:
- `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`

Do not guess legacy values. Use one or both deterministic methods:

1) **Etherscan read path:** open legacy contract -> `Read Contract` and capture values.

2) **CLI extraction path:**
```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```

Owner sign-off: mark each parameter as “same as legacy” or “intentionally different” with rationale.

---

## 3) Environment Setup (Operator steps)

### Node/npm version alignment

CI uses Node.js 20 (`actions/setup-node@v4` with `node-version: 20`). Use Node 20 locally for parity.

### Install dependencies

```bash
npm ci
```

### Compile contracts

```bash
npx truffle compile
```

### Where deployment configuration lives

- Template file: `migrations/config/agijobmanager.config.example.js`
- Default active file: `migrations/config/agijobmanager.config.js`
- Optional override: `AGIJOBMANAGER_CONFIG_PATH=/absolute/or/relative/path.js`

### Environment variables (safe handling)

Never commit secrets. Set in shell/session vault only.

```bash
export PRIVATE_KEYS="<comma-separated-private-keys>"
export MAINNET_RPC_URL="https://<mainnet-rpc>"
export SEPOLIA_RPC_URL="https://<sepolia-rpc>"
export AGIJOBMANAGER_DEPLOY=1
export DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
export ETHERSCAN_API_KEY="<etherscan-key>"
```

Stop condition:
- Do not proceed if `git diff` shows secrets or if config contains placeholder values.

---

## 4) Mainnet Dry-Run / Rehearsal (Required)

This repository supports dry-run mode in migration #6.

### Step A — dry-run validation (no chain writes)

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network sepolia --f 6 --to 6
```

What you do:
- Validate config shape, guard logic, and summary output.

What you should see:
- deployment summary with network/chain/deployer/config hash,
- `DEPLOY_DRY_RUN=1 detected: config validated, deployment skipped.`

### Step B — full rehearsal on supported testnet (same migration)

```bash
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network sepolia --f 6 --to 6
```

Capture and archive:
- network and chainId,
- deployer address,
- library addresses,
- `AGIJobManager` address,
- tx hashes and block number,
- config hash,
- receipt file path: `deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`.

Stop condition:
- Do not schedule mainnet until owner approves rehearsal evidence bundle.

---

## 5) Deployment Flow Diagram (Mermaid)

```mermaid
flowchart TD
    A[Prepare owner-approved decisions] --> B[Configure agijobmanager.config.js]
    B --> C[Rehearse: DEPLOY_DRY_RUN=1]
    C --> D[Rehearse: Sepolia deploy with migration #6]
    D --> E{Owner approves rehearsal evidence?}
    E -->|No| B
    E -->|Yes| F[Mainnet deploy with explicit confirmation guard]
    F --> G[Verify libraries + AGIJobManager on Etherscan]
    G --> H{Ownership transferred in migration config?}
    H -->|Yes| I[Confirm owner() on Etherscan]
    H -->|No| J[Manual transferOwnership on Etherscan]
    I --> K{ENS enabled?}
    J --> K
    K -->|On| L[Confirm ENS fields and root nodes]
    K -->|Off/neutral| M[Confirm neutral ENS posture]
    L --> N{Merkle roots set now?}
    M --> N
    N -->|Yes| O[Confirm roots on-chain]
    N -->|Later| P[Track deferred governance action]
    O --> Q[Post-deploy sanity checks]
    P --> Q
    Q --> R[Go-live]
```

---

## 6) Step-by-Step: Ethereum Mainnet Deployment via Truffle Migrations

### Production migration file and number

Use:
- `migrations/6_deploy_agijobmanager_production_operator.js`
- migration range flags: `--f 6 --to 6`

### Execution steps

1) Create/prepare deployment config file:
```bash
cp migrations/config/agijobmanager.config.example.js migrations/config/agijobmanager.config.js
```

2) Validate on mainnet target without writes:
```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network mainnet --f 6 --to 6
```

3) Owner sign-off gate (manual):
- Verify checklist approvals (owner address, token, ENS, roots, lock policy).
- Verify operator has correct account and sufficient ETH.
- Verify `DEPLOY_CONFIRM_MAINNET` value prepared exactly.

4) Mainnet deployment:
```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET npx truffle migrate --network mainnet --f 6 --to 6
```

### Mainnet confirmation guard

Migration #6 hard-blocks chainId 1 unless `DEPLOY_CONFIRM_MAINNET` matches the exact confirmation string above.

### What you should see in console output

- Deployment summary with config hash and warnings.
- Library deployment messages.
- AGIJobManager deployment transaction/address.
- Post-deploy owner action transaction hashes.
- Final lines:
  - `Deployment completed successfully.`
  - `AGIJobManager: <address>`
  - `Receipt: deployments/mainnet/AGIJobManager.<chainId>.<blockNumber>.json`

Stop condition:
- Do not proceed if receipt file is missing or if any verification assertion failed in migration output.

---

## 7) Verification on Etherscan (Web, step-by-step)

Linked libraries are critical because AGIJobManager bytecode is linked with deployed library addresses. Any library mismatch causes verification mismatch.

### Path A — Truffle verification plugin

This repository config enables `truffle-plugin-verify`.

Prerequisite:
```bash
export ETHERSCAN_API_KEY="<etherscan-key>"
```

Commands (use addresses from receipt):
```bash
npx truffle run verify UriUtils@<UriUtilsAddress> --network mainnet
npx truffle run verify TransferUtils@<TransferUtilsAddress> --network mainnet
npx truffle run verify BondMath@<BondMathAddress> --network mainnet
npx truffle run verify ReputationMath@<ReputationMathAddress> --network mainnet
npx truffle run verify ENSOwnership@<ENSOwnershipAddress> --network mainnet
npx truffle run verify AGIJobManager@<AGIJobManagerAddress> --network mainnet
```

### Path B — Manual Etherscan verification

1) Open contract on Etherscan -> `Contract` -> `Verify and Publish`.
2) Use exact compiler settings from build artifacts (`build/contracts/AGIJobManager.json`):
   - Solidity: `0.8.23`
   - Optimization: enabled
   - Runs: `40`
   - EVM version: `shanghai` (unless intentionally overridden by env)
   - viaIR: disabled
3) Enter linked library addresses exactly as deployed.
4) Constructor args:
   - Preferred source: `constructorArgs` in deployment receipt JSON.
   - Deterministic encoding helper:
     ```bash
     node scripts/ops/encode_constructor_args.js --receipt deployments/mainnet/AGIJobManager.<chainId>.<blockNumber>.json
     ```
   - Paste output hex (without `0x`) in constructor args field.

### Common verification failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Immediate bytecode mismatch | Wrong compiler version | Read `compiler.version` in artifact and match exactly |
| Metadata mismatch | Wrong optimizer settings | Ensure optimizer enabled and runs `40` |
| Unresolved library placeholders | Wrong library addresses | Use addresses from deployment receipt |
| Constructor mismatch | Wrong or partial args | Re-encode from receipt helper script |
| “Similar match only” | Artifact/build drift | Recompile cleanly (`npx truffle compile --all`) and retry |

---

## 8) Ownership Transfer to Final Owner (Must include Etherscan web flow)

Best practice: deploy with operator-controlled EOA, then transfer to final owner (usually multisig) immediately after successful verification.

### Path A — ownership transferred in migration

If config sets `ownership.finalOwner`, migration #6 executes `transferOwnership(finalOwner)`.

What you do:
- open verified contract in Etherscan `Read Contract`, call `owner()`.

What you should see:
- `owner()` equals approved final owner address.

### Path B — manual ownership transfer on Etherscan

1) Open AGIJobManager on Etherscan.
2) Open `Write Contract`.
3) Connect current owner wallet (deployer EOA if ownership not yet transferred).
4) Call `transferOwnership(newOwner)` with approved final owner.
5) Wait for confirmation.
6) Open `Read Contract` and confirm `owner()`.

Do not proceed if:
- final owner address does not exactly match approved address,
- `owner()` is still deployer when multisig ownership was required,
- contract is not verified (owner review transparency is insufficient).

---

## 9) Post-Deployment Sanity Checks (Owner-friendly, Etherscan-based)

Use Etherscan `Read Contract` after verification.

| Read item | What to confirm |
| --- | --- |
| `owner()` | Final approved owner address |
| `agiToken()` | Approved token address (legacy default baseline: AGIALPHA `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`) |
| `paused()`, `settlementPaused()` | Match approved launch posture |
| `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()`, `voteQuorum()` | Match approved governance thresholds |
| `completionReviewPeriod()`, `disputeReviewPeriod()`, `challengePeriodAfterApproval()` | Match approved timing windows |
| `validatorMerkleRoot()`, `agentMerkleRoot()` | Match approved roots or intentional zero roots |
| ENS fields: `ens()`, `nameWrapper()`, `clubRootNode()`, `agentRootNode()`, `alphaClubRootNode()`, `alphaAgentRootNode()`, `ensJobPages()` | Match ENS enablement decision |
| `withdrawableAGI()` | Amount owner may withdraw without touching escrowed balances |

### What owner can/cannot do immediately (contract-pattern based)

Owner-controlled functions include (examples):
- pause controls: `pause()`, `unpause()`, `pauseAll()`, `unpauseAll()`, `setSettlementPaused(bool)`,
- governance/settings: `setVoteQuorum`, validator threshold setters, period setters, bond/slash setters,
- allowlisting/moderation: `updateMerkleRoots`, additional list setters, blacklist functions, `addModerator`/`removeModerator`,
- identity/configuration: `updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `setEnsJobPages`, `setUseEnsJobTokenURI`.

Special conditions to review before changes:
- identity setters are blocked after `lockIdentityConfiguration()` (guarded by `whenIdentityConfigurable`),
- some parameter updates require no active escrow/bond state (guarded by `whenNoActiveEscrowOrBond`).

---

## 10) Minimal Go-Live Configuration (Optional but useful)

Conservative initial sequence:

1. Add only essential moderators.
2. Apply minimal allowlisting needed for controlled launch (lists and/or Merkle roots).
3. Confirm identity presentation fields (`baseIpfsUrl`, ENS job pages policy) before public usage.
4. Confirm pause posture aligns with launch plan.
5. Delay irreversible identity lock until owner confirms all identity dependencies and integrations.

---

## 11) Appendix: Legacy Defaults (How to Compare Against Legacy Contract)

Legacy reference contract:
- `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`

Comparison procedure:

1) Read legacy values on Etherscan (`Read Contract`).
2) Optionally extract deterministic JSON:
```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```
3) Compare with:
- new deployment receipt JSON (`deployments/mainnet/...json`), and
- new deployment `Read Contract` outputs.

Use this as a **suggested starting point** only. Do not assume equality is required.

| Parameter | Legacy read location | New contract getter/setter |
| --- | --- | --- |
| owner | Legacy `Read Contract` -> `owner()` | `owner()` / `transferOwnership(address)` |
| agiToken | Legacy `Read Contract` -> `agiToken()` | `agiToken()` / `updateAGITokenAddress(address)` |
| pause posture | Legacy `paused()`, `settlementPaused()` | same getters / pause setters |
| validator thresholds | Legacy `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()` | same getters / threshold setters |
| vote quorum | Legacy `voteQuorum()` | `voteQuorum()` / `setVoteQuorum(uint256)` |
| review windows | Legacy period getters | period getters / period setters |
| challenge period | Legacy `challengePeriodAfterApproval()` if present | same getter / setter |
| Merkle roots | Legacy root getters | root getters / `updateMerkleRoots(bytes32,bytes32)` |
| ENS configuration | Legacy ENS getters | ENS getters / ENS setters |

---

## 12) Troubleshooting (Symptoms → causes → fixes)

| Symptom | Likely cause | Recommended fix |
| --- | --- | --- |
| Mainnet migration blocked immediately | Missing/incorrect `DEPLOY_CONFIRM_MAINNET` | Set exact confirmation string and rerun |
| Migration skipped unexpectedly | `AGIJOBMANAGER_DEPLOY` not `1` or existing deployment detected | Export `AGIJOBMANAGER_DEPLOY=1`; review redeploy guard message |
| Wrong network/chainId | RPC/`--network` mismatch | Stop, document incident, and redeploy only after owner re-approval |
| Verification mismatch | Compiler/optimizer/library/args mismatch | Re-check artifact settings and receipt, then retry |
| Ownership transfer failed | Caller is not current owner or wrong target address | Execute from current owner, validate target, retry |
| Insufficient gas funds | Deployer wallet underfunded or gas caps too low | Fund wallet and rerun with approved gas policy |
| RPC rate limit / nonce collisions | Endpoint contention or concurrent signer usage | Use single operator signer, retry with backoff, stabilize endpoint |

Final stop rule:
- If any approved checklist item does not match on-chain state, pause go-live and require explicit owner re-approval.
