# Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle Migrations)

## 1) Executive Summary

This guide defines the production process for deploying AGIJobManager to Ethereum mainnet using this repository’s Truffle migration flow, then verifying on Etherscan and transferring ownership safely.

### What is being deployed

Deployment includes:
- linked libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`), and
- the main `AGIJobManager` contract from migration `6_deploy_agijobmanager_production_operator.js`.

### AI-agents-only policy (critical)

AGIJobManager is intended for autonomous AI agents as protocol participants. Humans act as supervisors/operators/owners.

The authoritative legal Terms & Conditions are embedded in the header comment of `contracts/AGIJobManager.sol`. This guide summarizes operational implications only; do not treat this guide as legal text.

### Owner vs Operator

- **Owner**: approves risk/configuration decisions and receives final contract ownership (preferably multisig).
- **Operator**: executes approved deployment and verification steps.

### Highest-risk irreversible mistakes

1. Deploying on wrong chain / wrong migration range.
2. Deploying with wrong token/ENS/root values.
3. Locking identity configuration too early (`lockIdentityConfiguration`).
4. Transferring ownership to the wrong address.
5. Verifying with wrong compiler/library/constructor settings and losing auditability.

---

## 2) Pre-Deployment Decisions (Owner checklist)

Check each item before the operator runs any mainnet transaction.

- [ ] **Final owner address approved** (recommended multisig).
  - Deployer EOA may be temporary, but final owner must be explicitly approved.
- [ ] **RPC provider approved** (institutional reliability, archival needs, key management).
- [ ] **Gas strategy approved** (EIP-1559 policy, max-fee boundaries, replacement/nonce policy).
- [ ] **Token address approved**.
  - Legacy default — verify: `AGIALPHA` mainnet `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.
- [ ] **ENS posture approved** (enabled now vs neutral/disabled now).
  - ENS fields affect identity authorization behavior and post-deploy governance scope.
- [ ] **Allowlisting model approved**.
  - Direct lists (`additionalAgents`, `additionalValidators`) vs Merkle roots vs ENS ownership path.
- [ ] **Identity lock timing approved**.
  - `lockIdentityConfiguration` is one-way.
  - Lock freezes identity setters (`updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `setEnsJobPages`).
- [ ] **Legacy defaults policy approved**.
  - Policy: start from legacy values, then explicitly adjust and re-approve.

### Legacy defaults — verify

Reference legacy deployment:
- Legacy AGIJobManager: `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.

Do **not** assume values from memory. Use:
1. Etherscan `Read Contract` on legacy address, and/or
2. deterministic CLI extraction script in this repo:
   ```bash
   npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
   ```

Treat extracted values as **suggested starting point**, not forced equivalence.

---

## 3) Environment Setup (Operator steps)

### Node/npm alignment

CI workflows pin Node.js 20. Use Node 20 locally for parity.

### Install + compile

```bash
npm ci
npx truffle compile
```

### Deployment configuration location

- Template: `migrations/config/agijobmanager.config.example.js`
- Active config: `migrations/config/agijobmanager.config.js` (or override with `AGIJOBMANAGER_CONFIG_PATH`).

### Safe environment-variable handling

Set secrets in terminal/secret manager only, never in committed files:

```bash
export MAINNET_RPC_URL="https://<your-rpc>"
export PRIVATE_KEYS="<comma-separated-private-keys>"
export AGIJOBMANAGER_DEPLOY=1
export DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
export ETHERSCAN_API_KEY="<optional-for-plugin-verification>"
```

STOP: Do not proceed if any secret appears in git diff.

---

## 4) Mainnet Dry-Run / Rehearsal (Required)

Use the same migration/config path as production.

### A. Dry-run config validation (no chain writes)

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network sepolia --f 6 --to 6
```

`DEPLOY_DRY_RUN=1` validates config and prints summary without deployment transactions.

### B. Full rehearsal on test network

```bash
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network sepolia --f 6 --to 6
```

Capture and archive:
- chainId/network
- deployer address
- all library addresses
- AGIJobManager address
- tx hashes/block number
- config hash
- generated receipt JSON path (`deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`).

STOP: do not schedule mainnet until rehearsal evidence is complete and owner-approved.

---

## 5) Deployment Flow Diagram (Mermaid)

```mermaid
flowchart TD
    A[Prepare approved owner decisions] --> B[Configure agijobmanager.config.js]
    B --> C[Dry-run validation DEPLOY_DRY_RUN=1]
    C --> D[Sepolia rehearsal with migration #6]
    D --> E{Rehearsal evidence approved?}
    E -->|No| B
    E -->|Yes| F[Mainnet deploy with explicit guard confirmation]
    F --> G[Verify libraries + AGIJobManager on Etherscan]
    G --> H{Ownership transfer in migration config?}
    H -->|Yes| I[Confirm owner() on Etherscan]
    H -->|No| J[Manual transferOwnership on Etherscan]
    I --> K{ENS enabled now?}
    J --> K
    K -->|Yes| L[Confirm ENS fields + root nodes]
    K -->|No| M[Confirm neutral ENS posture]
    L --> N{Set Merkle roots now?}
    M --> N
    N -->|Now| O[Confirm roots on-chain]
    N -->|Later| P[Track deferred governance action]
    O --> Q[Post-deploy sanity checks]
    P --> Q
    Q --> R[Go-live]
```

---

## 6) Step-by-Step: Ethereum Mainnet Deployment via Truffle Migrations

### Production migration to use

Use migration file:
- `migrations/6_deploy_agijobmanager_production_operator.js` (migration #6).

### Commands

1) Prepare config:
```bash
cp migrations/config/agijobmanager.config.example.js migrations/config/agijobmanager.config.js
```

2) Validate config shape and values first:
```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network mainnet --f 6 --to 6
```

3) Mainnet guarded deploy:
```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET npx truffle migrate --network mainnet --f 6 --to 6
```

### Mainnet guard

Migration enforces explicit confirmation string for chainId=1; deployment aborts if missing/mismatched.

### What you should see

Console output should include:
- deployment summary (network/chain/deployer/config hash),
- library deployment lines,
- AGIJobManager address,
- post-deploy action tx hashes,
- receipt path.

### Deployment receipt location

Receipt is written to:
- `deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`.

STOP: do not continue to ownership transfer if receipt file is missing.

---

## 7) Verification on Etherscan (Web, step-by-step)

Linked libraries matter because AGIJobManager bytecode is linked at deployment time; wrong library addresses create bytecode mismatch.

### Path A: Plugin-based verification (repo tooling)

This repo includes `truffle-plugin-verify` in `truffle-config.js`.

1) Ensure `ETHERSCAN_API_KEY` is set.
2) Verify libraries and main contract:

```bash
npx truffle run verify UriUtils@<uriUtilsAddress> --network mainnet
npx truffle run verify TransferUtils@<transferUtilsAddress> --network mainnet
npx truffle run verify BondMath@<bondMathAddress> --network mainnet
npx truffle run verify ReputationMath@<reputationMathAddress> --network mainnet
npx truffle run verify ENSOwnership@<ensOwnershipAddress> --network mainnet
npx truffle run verify AGIJobManager@<managerAddress> --network mainnet
```

Use addresses from deployment receipt JSON.

### Path B: Manual Etherscan verification

1) Open contract address on Etherscan → **Contract** → **Verify and Publish**.
2) Set compiler settings exactly as build artifacts:
   - Solidity compiler version: `0.8.23`
   - optimizer: enabled
   - runs: `40`
   - EVM version: `shanghai` (default unless overridden)
   - viaIR: disabled.
3) Supply linked library addresses exactly from receipt.
4) Constructor arguments:
   - preferred source: `constructorArgs` from deployment receipt JSON.
   - deterministic encoding helper:
     ```bash
     node scripts/ops/encode_constructor_args.js --receipt deployments/mainnet/AGIJobManager.<chainId>.<blockNumber>.json
     ```
   - paste output hex (without `0x`) into Etherscan constructor-args field.

### Common verification failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Bytecode mismatch immediately | Wrong compiler version | Read `build/contracts/AGIJobManager.json` and match exactly |
| Metadata mismatch | Wrong optimizer runs | Use optimizer enabled + runs `40` |
| Library placeholders unresolved | Wrong library addresses | Copy addresses from receipt JSON |
| Constructor mismatch | Wrong/partial constructor args | Re-encode from receipt using helper script |
| “Similar match only” | Compiled with different artifact state | Re-run clean compile (`npx truffle compile --all`) and verify again |

---

## 8) Ownership Transfer to Final Owner (Etherscan web flow required)

Best practice: deploy with a controlled EOA, then transfer ownership to approved multisig.

### Path A: Automatic ownership transfer in migration

If `ownership.finalOwner` is set in deployment config, migration calls `transferOwnership(finalOwner)` as part of deployment actions.

Confirm on Etherscan `Read Contract -> owner()`.

### Path B: Manual transfer on Etherscan

1) Open deployed AGIJobManager page.
2) Go to **Write Contract**.
3) Connect deployer wallet.
4) Call `transferOwnership(newOwner)`.
5) Wait for tx confirmation.
6) Validate with **Read Contract** `owner()`.

### Do not proceed if …

- new owner address was not approved in owner checklist.
- `owner()` is still deployer EOA when multisig was required.
- contract is not verified (limits governance/audit transparency).

---

## 9) Post-Deployment Sanity Checks (Owner-friendly, Etherscan-based)

Run on Etherscan **Read Contract** after verification.

| Getter | Expected review |
| --- | --- |
| `owner()` | Final approved owner (usually multisig) |
| `agiToken()` | Approved token address (default legacy-start: AGIALPHA mainnet) |
| `paused()` / `settlementPaused()` | Match planned launch posture |
| `requiredValidatorApprovals()` / `requiredValidatorDisapprovals()` / `voteQuorum()` | Match approved thresholds |
| `completionReviewPeriod()` / `disputeReviewPeriod()` / `challengePeriodAfterApproval()` | Match approved windows |
| `validatorMerkleRoot()` / `agentMerkleRoot()` | Match approved allowlist roots |
| `ens()` / `nameWrapper()` / root-node getters / `ensJobPages()` | Match ENS enablement decision |
| `withdrawableAGI()` | Non-escrow AGI currently withdrawable by owner; confirm expected value before any withdrawal |

### What owner can change immediately vs conditionally

Owner-only controls include pause/unpause, settlement pause, allowlists/blacklists, moderator management, Merkle roots, and parameters through explicit setters.

Some sensitive setters are condition-gated:
- Identity setters require `whenIdentityConfigurable` (blocked after lock).
- Parameter setters with `whenNoActiveEscrowOrBond` require empty active escrow/bond state before change (e.g., validator thresholds/quorum/review periods/slash settings).

---

## 10) Minimal Go-Live Configuration (Optional but useful)

Conservative first steps:

1. Add required moderators only.
2. Set direct allowlists and/or Merkle roots needed for first controlled jobs.
3. Confirm `baseIpfsUrl` posture.
4. Confirm pause posture (`paused`, `settlementPaused`) before announcing go-live.
5. Delay irreversible identity lock until owner confirms all identity fields and integrations.

---

## 11) Appendix: Legacy Defaults (How to Compare Against Legacy Contract)

Legacy reference contract:
- `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.

### Comparison method

1) On Etherscan legacy contract page, open **Read Contract** and capture values.
2) Optionally extract deterministically:
```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```
3) Compare to new deployment receipt and new contract read outputs.

Note: if a legacy getter is not present (for example `challengePeriodAfterApproval()` on older deployments), the helper outputs `null` for that field. Other RPC/call errors are surfaced and fail the script so operators do not get a false-success snapshot.

| Parameter | Legacy read location | New contract getter/setter |
| --- | --- | --- |
| owner | Etherscan Read: `owner()` | `owner()` / `transferOwnership(address)` |
| agiToken | Etherscan Read: `agiToken()` | `agiToken()` / `updateAGITokenAddress(address)` |
| validator thresholds | Etherscan Read: approvals/disapprovals | `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()` / setter pair |
| vote quorum | Etherscan Read: `voteQuorum()` | `voteQuorum()` / `setVoteQuorum(uint256)` |
| review/challenge windows | Etherscan Read: period getters | period getters / period setters |
| Merkle roots | Etherscan Read: root getters | root getters / `updateMerkleRoots(bytes32,bytes32)` |
| ENS wiring | Etherscan Read: ENS getters/root nodes | getters / ENS/root-node setters |

Do not assert equality by default. Explicitly approve any intentional divergence.

---

## 12) Troubleshooting (Symptoms → causes → fixes)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Migration aborts with mainnet guard error | Missing/wrong `DEPLOY_CONFIRM_MAINNET` value | Set exact required value and re-run |
| Migration skipped unexpectedly | `AGIJOBMANAGER_DEPLOY` not `1` | Export `AGIJOBMANAGER_DEPLOY=1` |
| Verify fails on Etherscan | Compiler/optimizer/library/args mismatch | Re-read receipt + build artifact settings; retry |
| Ownership transfer tx reverts | Caller is not current owner | Execute transfer from current owner address only |
| Wrong network deployed | RPC endpoint or `--network` mismatch | Halt, document incident, redeploy on correct network with fresh checklist |
| Out-of-gas / insufficient ETH | Fee cap too low or wallet underfunded | Fund deployer and re-submit with controlled fee policy |
| Nonce or rate-limit errors | RPC provider contention | Retry with backoff; ensure single deployment operator and nonce discipline |

STOP: If any mismatch appears between approved checklist and on-chain state, pause rollout and require owner re-approval.
