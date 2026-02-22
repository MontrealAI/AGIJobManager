# Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle Migrations)

## 1) Executive Summary

This guide is the production runbook for deploying AGIJobManager to Ethereum mainnet with this repository’s Truffle migration flow, verifying contracts on Etherscan, and transferring ownership to the approved final owner.

### What is being deployed

Deployment includes:
- linked Solidity libraries: `UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`, and
- the main `AGIJobManager` contract deployed by migration `migrations/6_deploy_agijobmanager_production_operator.js`.

### Critical policy: AI agents only

AGIJobManager is intended for **autonomous AI agents as active protocol participants**. Human participants are supervisors/operators/owners, not the intended day-to-day counterparties.

The authoritative Terms & Conditions text is embedded in the header comment of `contracts/AGIJobManager.sol`. This guide provides an operational summary only.

### Owner vs Operator responsibilities

- **Owner (decision authority):** approves deployment decisions (token, ENS posture, allowlisting model, final ownership, locking policy), signs off mainnet go/no-go, and receives final ownership.
- **Operator (execution authority):** executes commands, captures evidence, verifies bytecode, and performs ownership transfer exactly as approved.

### Highest-risk irreversible mistakes

1. Deploying to wrong chain/network.
2. Using wrong migration file/range.
3. Deploying with wrong constructor/config values.
4. Locking identity configuration too early.
5. Transferring ownership to the wrong address.
6. Failing verification due to wrong compiler/library/constructor settings.

**Stop condition:** if any approved value differs from what is shown in dry-run output, rehearsal output, or on-chain state, halt and re-approve before proceeding.

---

## 2) Pre-Deployment Decisions (Owner checklist)

Use this checklist for explicit owner approval before any mainnet transaction.

- [ ] **Final owner address approved** (recommended: multisig).
  - Deployer EOA can be temporary; final owner should be institutional custody.
- [ ] **RPC provider class approved** (availability, rate limits, nonce behavior, key management).
  - This guide does not endorse a specific vendor.
- [ ] **Gas strategy approved** (EIP-1559 policy and replacement policy).
  - Define who can bump transactions and how nonce collisions are prevented.
- [ ] **Token address approved.**
  - Legacy default — verify: AGIALPHA mainnet `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.
- [ ] **ENS feature posture approved** (enabled now vs neutral/off now).
  - ENS choices affect identity authorization behavior and governance actions.
- [ ] **Allowlisting model approved.**
  - Choose direct lists (`additionalAgents`, `additionalValidators`) and/or Merkle roots and/or ENS ownership checks.
- [ ] **Identity lock policy approved** (`lockIdentityConfiguration`).
  - Lock is one-way; after lock, identity setters are unavailable.
- [ ] **Legacy defaults policy approved.**
  - Policy: start from legacy values, then intentionally adjust.

### Legacy defaults — verify (suggested starting point only)

Reference legacy deployment:
- AGIJobManager: `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.

Never copy values from memory. Use:
1. Etherscan `Read Contract`, and/or
2. deterministic on-chain extraction script:

```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```

Treat extracted values as a **suggested starting point** and explicitly re-approve each value for the new deployment.

---

## 3) Environment Setup (Operator steps)

### Node/npm alignment

CI workflows use **Node.js 20**. Use Node 20 locally for parity.

### Install and compile

```bash
npm ci
npx truffle compile
```

### Where deployment configuration lives

- Template: `migrations/config/agijobmanager.config.example.js`
- Active file: `migrations/config/agijobmanager.config.js`
- Optional override path: `AGIJOBMANAGER_CONFIG_PATH`

### Set environment variables safely

Never commit secrets. Use terminal/session secrets only.

```bash
export MAINNET_RPC_URL="https://<your-mainnet-rpc>"
export PRIVATE_KEYS="<comma-separated-private-keys>"
export AGIJOBMANAGER_DEPLOY=1
export DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
export ETHERSCAN_API_KEY="<etherscan-api-key>"
```

**Stop condition:** do not proceed if `git diff` contains private keys, API keys, or RPC credentials.

---

## 4) Mainnet Dry-Run / Rehearsal (Required)

### A. Dry-run config validation (no chain writes)

What you do:

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network sepolia --f 6 --to 6
```

What you should see:
- deployment summary with network/chain/deployer/config hash,
- constructor argument summary,
- warning list (if any),
- message: `DEPLOY_DRY_RUN=1 detected: config validated, deployment skipped.`

### B. Full rehearsal on supported test network

What you do:

```bash
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network sepolia --f 6 --to 6
```

What you should capture for owner sign-off:
- chainId and network,
- deployer address,
- deployed library addresses,
- deployed `AGIJobManager` address,
- tx hashes and final block number,
- config path and config hash,
- generated receipt path (`deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`).

**Stop condition:** do not schedule mainnet deployment until rehearsal evidence is complete and approved.

---

## 5) Deployment Flow Diagram (Mermaid)

```mermaid
flowchart TD
    A[Prepare owner-approved decisions] --> B[Configure agijobmanager.config.js]
    B --> C[Dry-run validation]
    C --> D[Sepolia rehearsal]
    D --> E{Owner sign-off complete?}
    E -->|No| B
    E -->|Yes| F[Mainnet deploy with guard]
    F --> G[Verify libraries and AGIJobManager]
    G --> H{Ownership transfer in migration config?}
    H -->|Yes| I[Confirm owner()]
    H -->|No| J[Manual transferOwnership on Etherscan]
    I --> K{ENS enabled now?}
    J --> K
    K -->|Yes| L[Validate ENS fields]
    K -->|No| M[Validate neutral ENS posture]
    L --> N{Merkle roots set now?}
    M --> N
    N -->|Now| O[Validate roots]
    N -->|Later| P[Track deferred owner action]
    O --> Q[Post-deploy sanity checks]
    P --> Q
    Q --> R[Go-live]
```

---

## 6) Step-by-Step: Ethereum Mainnet Deployment via Truffle Migrations

### Production migration file and range

Use migration:
- **File:** `migrations/6_deploy_agijobmanager_production_operator.js`
- **Range:** `--f 6 --to 6`

### Mainnet operator procedure

1) Prepare active config file:

```bash
cp migrations/config/agijobmanager.config.example.js migrations/config/agijobmanager.config.js
```

2) Dry-run validation on mainnet config (no writes):

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network mainnet --f 6 --to 6
```

3) Mainnet deploy with explicit guard confirmation:

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET npx truffle migrate --network mainnet --f 6 --to 6
```

### Mainnet guard behavior

Migration #6 blocks chainId 1 deployment unless `DEPLOY_CONFIRM_MAINNET` matches exactly. This is an intentional anti-footgun guard.

### What you should see in console output

- a deployment summary block,
- deployment logs for each linked library,
- deployed `AGIJobManager` address,
- owner action tx hashes for post-deploy setters,
- final receipt path.

### Receipt location

On successful deployment, a JSON receipt is written to:

- `deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`

**Stop condition:** if receipt is missing or incomplete, do not continue to verification/ownership transfer.

---

## 7) Verification on Etherscan (Web, step-by-step)

### Why linked libraries matter

`AGIJobManager` bytecode is linked against deployed library addresses. If any library address is wrong during verification, Etherscan cannot match bytecode.

### Path A — Truffle plugin verification (recommended when available)

This repository configures `truffle-plugin-verify` in `truffle-config.js`.

Prerequisite:
- `ETHERSCAN_API_KEY` is set.

Run:

```bash
npx truffle run verify UriUtils@<uriUtilsAddress> --network mainnet
npx truffle run verify TransferUtils@<transferUtilsAddress> --network mainnet
npx truffle run verify BondMath@<bondMathAddress> --network mainnet
npx truffle run verify ReputationMath@<reputationMathAddress> --network mainnet
npx truffle run verify ENSOwnership@<ensOwnershipAddress> --network mainnet
npx truffle run verify AGIJobManager@<managerAddress> --network mainnet
```

Use addresses from the deployment receipt JSON, not from memory.

### Path B — Manual Etherscan verification

1) Open the contract page on Etherscan → `Contract` → `Verify and Publish`.
2) Set compiler exactly from artifacts / Truffle config:
   - Solidity version: `0.8.23`
   - Optimizer: enabled
   - Runs: `40`
   - EVM version: `shanghai` (unless your build explicitly set another value)
   - `viaIR`: disabled
3) Provide linked library addresses exactly as deployed.
4) Provide constructor arguments:
   - Source of truth: `constructorArgs` in deployment receipt JSON.
   - Deterministic encoder helper:

```bash
node scripts/ops/encode_constructor_args.js --receipt deployments/mainnet/AGIJobManager.<chainId>.<blockNumber>.json
```

Paste output into Etherscan constructor args field (hex without `0x`).

### Common verification failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Immediate bytecode mismatch | Wrong compiler version | Read `build/contracts/AGIJobManager.json` and match exactly |
| Metadata mismatch | Wrong optimizer setting/runs | Use optimizer enabled with runs `40` |
| Unresolved library placeholders | Wrong library addresses | Copy library addresses from deployment receipt |
| Constructor mismatch | Wrong argument order/value encoding | Re-encode from receipt using helper script |
| “Similar match” only | Build artifacts differ from deployed build | Rebuild deterministically (`npx truffle compile --all`) and retry |

---

## 8) Ownership Transfer to Final Owner (Must include Etherscan web flow)

Best practice: deploy from an operator EOA, then transfer ownership to the owner-approved multisig.

### Path A — ownership transferred automatically in migration

If config includes `ownership.finalOwner`, migration #6 calls `transferOwnership(finalOwner)`.

Owner confirmation:
- Etherscan `Read Contract` → `owner()` must equal the approved final owner.

### Path B — manual transfer in Etherscan

1) Open deployed AGIJobManager contract on Etherscan.
2) Go to `Write Contract`.
3) Connect the **current owner** wallet.
4) Execute `transferOwnership(newOwner)`.
5) Wait for transaction success.
6) Confirm in `Read Contract` via `owner()`.

### Do not proceed if …

- owner-approved address does not exactly match transfer target,
- `owner()` is still the deployer when final owner must be multisig,
- contract is not verified on Etherscan.

---

## 9) Post-Deployment Sanity Checks (Owner-friendly, Etherscan-based)

Use Etherscan `Read Contract` and validate:

| Getter | What to verify |
| --- | --- |
| `owner()` | Approved final owner (usually multisig) |
| `agiToken()` | Approved token address (legacy default start point: AGIALPHA `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`) |
| `paused()` and `settlementPaused()` | Match launch control policy |
| `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()`, `voteQuorum()` | Match approved voting thresholds |
| `completionReviewPeriod()`, `disputeReviewPeriod()`, `challengePeriodAfterApproval()` | Match approved governance windows |
| `validatorMerkleRoot()`, `agentMerkleRoot()` | Match approved root values |
| `ens()`, `nameWrapper()`, `clubRootNode()`, `agentRootNode()`, `alphaClubRootNode()`, `alphaAgentRootNode()`, `ensJobPages()` | Match ENS posture decision |
| `withdrawableAGI()` | Owner-withdrawable non-escrow AGI balance (not user escrow pool) |

### Owner permissions: what can be changed now vs conditionally

Owner-restricted controls include `pause`, `unpause`, `pauseAll`, `unpauseAll`, `setSettlementPaused`, `addModerator`, `removeModerator`, `updateMerkleRoots`, and `withdrawAGI`.

Identity setters (`updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `setEnsJobPages`) are gated by identity-configurable state and become unavailable after `lockIdentityConfiguration`.

Some parameter changes are guarded by escrow/bond safety conditions (`whenNoActiveEscrowOrBond`), such as validator threshold updates and quorum/review-period updates (`setRequiredValidatorApprovals`, `setRequiredValidatorDisapprovals`, `setVoteQuorum`, `setCompletionReviewPeriod`, `setDisputeReviewPeriod`, `setChallengePeriodAfterApproval`).

---

## 10) Minimal Go-Live Configuration (Optional but useful)

Conservative initial sequence:

1. Add only required moderators.
2. Set allowlisting policy for initial jobs (direct lists and/or Merkle roots).
3. Confirm `baseIpfsUrl` posture.
4. Confirm `paused()` and `settlementPaused()` match rollout plan.
5. Delay `lockIdentityConfiguration` until owner has reviewed all identity fields.

---

## 11) Appendix: Legacy Defaults (How to Compare Against Legacy Contract)

Legacy reference:
- `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`

Comparison procedure:
1) Read legacy values in Etherscan `Read Contract`.
2) Optionally extract deterministically:

```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```

3) Compare with:
- new deployment receipt values, and
- new contract `Read Contract` values.

Do not assume one-to-one equality by default; treat as baseline for explicit owner decisions.

| Parameter | Legacy read location | New contract getter/setter |
| --- | --- | --- |
| Owner | Etherscan `owner()` | `owner()` / `transferOwnership(address)` |
| AGI token | Etherscan `agiToken()` | `agiToken()` / `updateAGITokenAddress(address)` |
| Pause posture | Etherscan `paused()`, `settlementPaused()` | same getters / pause setters |
| Validator thresholds | Etherscan approvals/disapprovals getters | `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()` + setters |
| Vote quorum | Etherscan `voteQuorum()` | `voteQuorum()` / `setVoteQuorum(uint256)` |
| Review/challenge periods | Etherscan period getters | same getters + setters |
| Merkle roots | Etherscan root getters | same getters / `updateMerkleRoots(bytes32,bytes32)` |
| ENS fields | Etherscan ENS getters + root node getters | same getters + ENS/root-node setters |

---

## 12) Troubleshooting (Symptoms → causes → fixes)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Mainnet migration blocked by guard | Missing/wrong `DEPLOY_CONFIRM_MAINNET` | Set exact confirmation string and rerun |
| Migration appears skipped | `AGIJOBMANAGER_DEPLOY` not set to `1` | Export `AGIJOBMANAGER_DEPLOY=1` |
| Verification mismatch | Wrong compiler/options/libraries/args | Re-check receipt + build artifacts, then retry |
| Ownership transfer reverted | Caller is not current owner | Submit transfer from current owner address |
| Deployment on wrong chainId/network | Wrong RPC URL or `--network` selection | Halt rollout, document incident, redeploy with approved settings |
| Insufficient gas funds | Deployer ETH balance too low | Fund deployer and re-run with controlled gas policy |
| RPC throttling/nonce drift | Provider rate limits or parallel signers | Use single operator, serialized tx flow, backoff retries |

**Final stop condition:** if any approved checklist item does not match observed on-chain state, pause go-live and obtain explicit owner re-approval.
