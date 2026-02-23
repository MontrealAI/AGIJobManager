# Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle Migrations)

> **Legacy-but-supported path:** Truffle remains supported for backward compatibility and historical reproducibility. For new deployments, use the recommended Hardhat workflow in `hardhat/README.md`.

## 1) Executive Summary

This guide is the production runbook for deploying AGIJobManager to Ethereum mainnet using this repository’s Truffle migration flow, then verifying contracts on Etherscan and transferring ownership to the approved final owner.

### What is being deployed

The production deployment consists of:

- linked libraries: `UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`
- main contract: `AGIJobManager`
- deployment automation: `migrations/6_deploy_agijobmanager_production_operator.js`

### Critical intended-use policy (must be understood before deployment)

AGIJobManager is intended to be used by **autonomous AI agents exclusively** for normal protocol participation. Humans are supervisors/operators/owners.

- Human **Owner**: decision authority and risk owner
- Human **Operator**: executes deployment steps exactly as approved
- Human manual day-to-day protocol operation is out of scope for intended use

Authoritative Terms & Conditions are in the header comment of `contracts/AGIJobManager.sol`. This guide summarizes operations and does not reproduce legal text.

### Responsibilities: Owner vs Operator

| Role | Responsibilities | Must approve/sign |
| --- | --- | --- |
| Owner | chooses final owner address, token, ENS posture, allowlisting model, lock policy, go-live posture | pre-deployment decisions, mainnet go/no-go, final ownership acceptance |
| Operator | prepares environment, runs migrations, captures receipts/logs, performs verification and ownership transfer | execution evidence package and completion checklist |

### Highest-risk irreversible mistakes

1. Deploying to the wrong network/chain.
2. Running the wrong migration number/range.
3. Using wrong config values for constructor and owner-controlled settings.
4. Locking identity configuration before all identity fields are confirmed.
5. Transferring ownership to the wrong address.
6. Proceeding without successful verification evidence.

**Do not proceed if any owner-approved value differs from rehearsal evidence, migration output, deployment receipt, or Etherscan readback.**

---

## 2) Pre-Deployment Decisions (Owner checklist)

Complete and sign this checklist before any mainnet transaction.

- [ ] **Final owner address approved** (recommended: multisig).
  - Deployer EOA is temporary; final owner should be durable institutional custody.
- [ ] **RPC provider strategy approved** (availability/rate limits/nonce behavior/key custody).
  - No specific vendor is endorsed by this guide.
- [ ] **Gas strategy approved** (EIP-1559 policy).
  - Define how max fee / priority fee are chosen and who can replace stuck transactions.
- [ ] **Token address approved**.
  - Legacy default — verify: AGIALPHA `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.
- [ ] **ENS feature posture approved** (enable now vs neutral/off).
  - ENS choices affect identity and eligibility checks.
- [ ] **Allowlisting model approved**.
  - Decide how to combine direct lists, Merkle roots, and ENS ownership checks.
- [ ] **Identity lock decision approved** (`lockIdentityConfiguration`).
  - Lock is one-way and freezes identity-config setters.
- [ ] **Legacy defaults policy approved**.
  - Policy: start with legacy state as a suggested baseline, then intentionally adjust.

### Legacy defaults — verify (suggested starting point, not auto-truth)

Legacy AGIJobManager reference: `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.

You must not guess legacy values. Obtain them from:

1. Etherscan → legacy contract → **Read Contract**, and/or
2. deterministic script:

```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```

Treat outputs as proposed defaults only, then explicitly approve each final mainnet value.

---

## 3) Environment Setup (Operator steps)

### Node/npm version alignment

CI workflows use Node.js 20. Use Node.js 20 locally for parity before compiling or deploying.

### Install dependencies

```bash
npm ci
```

### Compile

```bash
npx truffle compile
```

### Where deployment configuration lives

- template: `migrations/config/agijobmanager.config.example.js`
- local active config: `migrations/config/agijobmanager.config.js`
- optional override path env var: `AGIJOBMANAGER_CONFIG_PATH`

### Safe environment variable handling

Never commit secrets. Export credentials only in secure operator shells.

```bash
export MAINNET_RPC_URL="https://<your-mainnet-rpc>"
export PRIVATE_KEYS="<comma-separated-private-keys>"
export AGIJOBMANAGER_DEPLOY=1
export DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
export ETHERSCAN_API_KEY="<etherscan-api-key>"
```

**Do not proceed if secrets appear in tracked files (`git diff`, shell history policy, CI logs, or docs).**

---

## 4) Mainnet Dry-Run / Rehearsal (Required)

### A. Dry-run validation (no chain writes)

What you do:

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network sepolia --f 6 --to 6
```

What you should see:

- deployment summary with network, chainId, deployer, config path/hash
- constructor argument summary
- warning list (if any)
- `DEPLOY_DRY_RUN=1 detected: config validated, deployment skipped.`

### B. Full rehearsal using the same migration/config shape

What you do:

```bash
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network sepolia --f 6 --to 6
```

Capture evidence package:

- chainId and network
- deployer address
- library addresses
- AGIJobManager address
- tx hashes and block number
- config path and config hash
- generated receipt path (`deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`)

**Do not proceed to mainnet until owner signs off on rehearsal evidence.**

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
    G --> H{Transfer ownership in migration config?}
    H -->|Yes| I[Confirm owner() on Etherscan]
    H -->|No| J[Manual transferOwnership on Etherscan]
    I --> K{ENS enabled?}
    J --> K
    K -->|Yes| L[Confirm ENS fields]
    K -->|No| M[Confirm neutral ENS posture]
    L --> N{Set Merkle roots now?}
    M --> N
    N -->|Now| O[Confirm roots]
    N -->|Later| P[Record deferred owner action]
    O --> Q[Post-deployment sanity checks]
    P --> Q
    Q --> R[Go-live]
```

---

## 6) Step-by-Step: Ethereum Mainnet Deployment via Truffle Migrations

### Production migration to use

Use exactly:

- migration number: `6`
- file: `migrations/6_deploy_agijobmanager_production_operator.js`
- command range: `--f 6 --to 6`

### Mainnet guard and operator gate

The migration enforces a mainnet confirmation guard. For chainId 1, deployment is blocked unless:

```text
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
```

### Operator execution steps

1. Prepare local config from template.

```bash
cp migrations/config/agijobmanager.config.example.js migrations/config/agijobmanager.config.js
```

2. Dry-run against mainnet configuration (no writes).

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network mainnet --f 6 --to 6
```

3. Owner sign-off checkpoint (manual, mandatory):

- [ ] dry-run summary reviewed
- [ ] constructor arguments reviewed
- [ ] final owner address reviewed
- [ ] token address reviewed
- [ ] ENS and Merkle posture reviewed

**Do not proceed if any item is unapproved.**

4. Run mainnet deployment.

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET npx truffle migrate --network mainnet --f 6 --to 6
```

### What you should see

- deployment summary section
- library deployment addresses and tx hashes
- AGIJobManager deployment address and tx hash
- post-deploy owner action tx hashes
- final line with receipt location

### Deployment receipt location

Successful migration writes:

```text
deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json
```

Receipt contains chainId/network/deployer, linked library addresses, AGIJobManager address, tx hashes, constructor args, config hash, and verification checks.

**Do not proceed to Etherscan verification if receipt is missing or incomplete.**

---

## 7) Verification on Etherscan (Web, step-by-step)

### Why linked libraries matter

AGIJobManager bytecode is linked against deployed library addresses. If library addresses provided to verification are incorrect, Etherscan bytecode matching fails.

### Path A: Truffle plugin verification (configured in repo)

Prerequisite: `ETHERSCAN_API_KEY` set in environment.

Verify deployed addresses from your deployment receipt (never from memory):

```bash
npx truffle run verify UriUtils@<uriUtilsAddress> --network mainnet
npx truffle run verify TransferUtils@<transferUtilsAddress> --network mainnet
npx truffle run verify BondMath@<bondMathAddress> --network mainnet
npx truffle run verify ReputationMath@<reputationMathAddress> --network mainnet
npx truffle run verify ENSOwnership@<ensOwnershipAddress> --network mainnet
npx truffle run verify AGIJobManager@<managerAddress> --network mainnet
```

### Path B: Manual Etherscan verification

1. Open contract on Etherscan → `Contract` tab → `Verify and Publish`.
2. Use exact compiler settings from local build artifacts (`build/contracts/AGIJobManager.json`) and Truffle config:
   - compiler version: `0.8.23`
   - optimization: enabled
   - optimizer runs: `40`
   - EVM version: `shanghai` (unless intentionally overridden during deploy build)
   - `viaIR`: disabled
3. Provide the exact deployed linked library addresses.
4. Provide constructor arguments:
   - source of truth: `constructorArgs` in deployment receipt JSON
   - deterministic encoding helper:

```bash
node scripts/ops/encode_constructor_args.js --receipt deployments/mainnet/AGIJobManager.<chainId>.<blockNumber>.json
```

Paste resulting hex into Etherscan constructor-args field (without `0x`).

### Common verification failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Bytecode mismatch | wrong compiler version | read exact compiler from `build/contracts/AGIJobManager.json` and retry |
| Metadata mismatch | wrong optimizer/runs | set optimizer enabled, runs `40` |
| Unlinked library placeholders | wrong library addresses | copy libraries from deployment receipt |
| Constructor arg mismatch | wrong encoding/order/value | regenerate with `encode_constructor_args.js` from receipt |
| Similar match only | artifacts not from deploy build | clean/compile deterministically (`npx truffle compile --all`) and retry |

---

## 8) Ownership Transfer to Final Owner (Must include Etherscan web flow)

Best practice: deploy with operator EOA, then transfer ownership to the owner-approved multisig.

### Path A: Automatic ownership transfer in migration

If config sets `ownership.finalOwner`, migration #6 executes `transferOwnership(finalOwner)`.

Confirm in Etherscan `Read Contract`:

- `owner()` equals approved final owner address.

### Path B: Manual ownership transfer on Etherscan

1. Open deployed AGIJobManager in Etherscan.
2. Go to `Write Contract`.
3. Connect wallet for **current owner** address.
4. Call `transferOwnership(newOwner)` with approved final owner.
5. Wait for transaction success.
6. Confirm `owner()` in `Read Contract`.

### Do not proceed if …

- final owner address differs from owner-approved address
- `owner()` is still deployer when multisig ownership was required
- contract is not verified on Etherscan

---

## 9) Post-Deployment Sanity Checks (Owner-friendly, Etherscan-based)

Perform these reads on Etherscan and compare against the signed owner decision sheet.

| Getter | What to check |
| --- | --- |
| `owner()` | final owner is correct |
| `agiToken()` | token address is owner-approved (legacy default start point: AGIALPHA `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`) |
| `paused()` | intake pause posture matches rollout plan |
| `settlementPaused()` | settlement pause posture matches rollout plan |
| `requiredValidatorApprovals()` | approved threshold |
| `requiredValidatorDisapprovals()` | approved threshold |
| `voteQuorum()` | approved quorum |
| `completionReviewPeriod()` | approved review window |
| `disputeReviewPeriod()` | approved dispute window |
| `challengePeriodAfterApproval()` | approved challenge window |
| `validatorMerkleRoot()` | approved validator root |
| `agentMerkleRoot()` | approved agent root |
| `ens()` | ENS registry posture |
| `nameWrapper()` | ENS name wrapper posture |
| `clubRootNode()` / `agentRootNode()` / `alphaClubRootNode()` / `alphaAgentRootNode()` | approved root nodes |
| `ensJobPages()` | approved ENS pages contract address |
| `withdrawableAGI()` | owner-withdrawable non-escrow AGI (not user escrow pool) |

### Owner controls: what can be changed immediately vs conditionally

Owner-gated controls include `pause`, `unpause`, `pauseAll`, `unpauseAll`, `setSettlementPaused`, `addModerator`, `removeModerator`, `updateMerkleRoots`, `transferOwnership`, and `withdrawAGI`.

Identity setters are owner-gated and become unavailable after lock via `lockIdentityConfiguration`:

- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`
- `setEnsJobPages`

Some parameter setters are additionally guarded by no-active-escrow/bond conditions (`whenNoActiveEscrowOrBond`), including:

- `setRequiredValidatorApprovals`
- `setRequiredValidatorDisapprovals`
- `setVoteQuorum`
- `setCompletionReviewPeriod`
- `setDisputeReviewPeriod`
- `setChallengePeriodAfterApproval`

---

## 10) Minimal Go-Live Configuration (Optional but useful)

Conservative initial sequence (favor reversible actions first):

1. add only required moderators
2. set allowlisting policy (additional lists and/or Merkle roots)
3. confirm `baseIpfsUrl` posture
4. confirm `paused()` and `settlementPaused()` match launch posture
5. delay identity lock until owner confirms all identity fields

---

## 11) Appendix: Legacy Defaults (How to Compare Against Legacy Contract)

Legacy reference contract: `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.

Comparison process:

1. Read legacy values on Etherscan (`Read Contract`).
2. Optionally export deterministic JSON:

```bash
npx truffle exec scripts/ops/read_legacy_defaults.js --network mainnet --legacy 0x0178b6bad606aaf908f72135b8ec32fc1d5ba477
```

3. Compare legacy values to:
   - deployment receipt (`deployments/mainnet/...json`)
   - new contract Etherscan `Read Contract`

Do not assume legacy equivalence. Treat as baseline for explicit owner confirmation.

| Parameter | Legacy read location | New getter / setter |
| --- | --- | --- |
| Owner | `owner()` | `owner()` / `transferOwnership(address)` |
| AGI token | `agiToken()` | `agiToken()` / `updateAGITokenAddress(address)` |
| Pause posture | `paused()`, `settlementPaused()` | same getters + pause setters |
| Validator thresholds | `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()` | same getters + setters |
| Vote quorum | `voteQuorum()` | `voteQuorum()` / `setVoteQuorum(uint256)` |
| Review periods | `completionReviewPeriod()`, `disputeReviewPeriod()` | same getters + setters |
| Challenge period | `challengePeriodAfterApproval()` | same getter + setter |
| Merkle roots | `validatorMerkleRoot()`, `agentMerkleRoot()` | same getters / `updateMerkleRoots(bytes32,bytes32)` |
| ENS fields | ENS/root-node getters | same getters + ENS/root-node setters |

---

## 12) Troubleshooting (Symptoms → causes → fixes)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Mainnet migration blocked | `DEPLOY_CONFIRM_MAINNET` missing/incorrect | set exact guard value and rerun |
| Migration skipped | `AGIJOBMANAGER_DEPLOY` not `1` or existing deployment guard triggered | set `AGIJOBMANAGER_DEPLOY=1`; check existing deployment message and `AGIJOBMANAGER_ALLOW_REDEPLOY` policy |
| Verification mismatch | compiler/options/library/args mismatch | use receipt + artifact settings; re-encode constructor args |
| Ownership transfer fails | caller is not current owner | execute transfer from current owner address |
| Wrong chain/network | RPC URL or `--network` mismatch | halt, document, redeploy with approved network settings |
| Insufficient ETH for gas | deployer underfunded | fund deployer and rerun with approved fee strategy |
| RPC rate limits / nonce issues | provider throttling or parallel signers | serialize tx sender, backoff, and avoid concurrent signing |

Final safety gate: if any owner-approved item does not match chain state, pause go-live and obtain explicit owner re-approval.
