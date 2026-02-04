# AGIJobManager – Mainnet Deployment & Security Overview

## Executive summary
AGIJobManager is an **owner‑operated** on‑chain escrow and settlement contract for employer/agent jobs with validator approvals, dispute resolution, reputation tracking, and a tightly scoped NFT marketplace for job completions. It is **not** a trustless or DAO‑governed protocol. Instead, it enforces strict escrow accounting and identity gating while keeping operational controls with the owner and moderators. All statements below reflect the current on‑chain implementation and Truffle configuration.

## Trust model (owner‑operated, not trustless)
AGIJobManager is a centralized operational system with strong on‑chain safety invariants. Users rely on:
- **Owner integrity** for parameter tuning, allowlist/blacklist management, and operational incident response.
- **Moderator integrity** for dispute resolution outcomes.
- **Escrow accounting** enforced by `lockedEscrow` and `withdrawableAGI()` to prevent owner withdrawal of unsettled job funds.

This is an **owner‑controlled** business system with enforceable escrow guarantees, not a decentralized court or DAO.

## Owner privileges (key controls)
The owner can:
- **Pause/unpause** operations (`pause`, `unpause`).
- **Update allowlists/blacklists** (Merkle roots, explicit blacklists).
- **Tune parameters** (validator thresholds, payout bounds, review periods, max payout, duration limit).
- **Manage moderators** (add/remove).
- **Resolve stale disputes** only while paused (`resolveStaleDispute`).
- **Delist jobs** that are still unassigned (`delistJob`) and refund escrow.
- **Withdraw treasury AGI** while paused (`withdrawAGI`).

Moderators (not owner) resolve disputes via `resolveDispute` / `resolveDisputeWithCode`.

## Identity wiring lock
The contract exposes a one‑way identity configuration lock (`lockIdentityConfiguration`). This lock:

### Frozen by the lock
Once `lockIdentityConfiguration()` is called, the following **cannot** be updated:
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`

Additionally, these identity updates require **no jobs to exist** (`nextJobId == 0`) and **no escrowed funds** (`lockedEscrow == 0`), even before the lock is set.

### Not frozen by the lock
The lock **does not** restrict:
- Operations controls (pause/unpause, blacklists, parameter tuning)
- Treasury withdrawals (`withdrawAGI`)
- Job settlement flows
- **Merkle root updates** (`updateMerkleRoots` remains allowed)

The lock is designed to freeze identity wiring only; it is **not** a governance lock.

## Pause semantics (what is blocked vs allowed)
Pause is an incident‑response control intended to halt new activity without trapping exits. The exact behavior is:

### Blocked while paused
| Category | Functions |
| --- | --- |
| Job creation/onboarding | `createJob`, `applyForJob` |
| Validation & new disputes | `validateJob`, `disapproveJob`, `disputeJob` |
| Marketplace entry | `listNFT`, `purchaseNFT` |
| Reward pool funding | `contributeToRewardPool` |

### Allowed while paused
| Category | Functions |
| --- | --- |
| Completion request | `requestJobCompletion` (assigned agent only) |
| Settlement & exits | `cancelJob`, `expireJob`, `finalizeJob`, `resolveDispute`, `resolveDisputeWithCode` |
| Stale dispute recovery | `resolveStaleDispute` (owner‑only, paused‑only) |
| Marketplace exit | `delistNFT` |
| Treasury withdrawal | `withdrawAGI` (owner‑only, paused‑only) |

This ensures pause does not trap existing jobs or listings.

## Treasury vs escrow (withdrawal rules)
- **Escrowed funds**: tracked in `lockedEscrow` and reserved for unsettled job payouts.
- **Treasury**: the contract’s AGI balance **minus** `lockedEscrow`.

### `withdrawableAGI()` invariant
`withdrawableAGI()` returns `balance - lockedEscrow` and **reverts** if the balance is below `lockedEscrow` (insolvent escrow is not allowed).

### Sources of treasury funds
Treasury can grow from:
- **Remainders** after settlement when agent + validators receive less than 100%.
- **Rounding dust** from payout calculations.
- **Reward pool contributions** (`contributeToRewardPool`) — currently **not segregated**, so they become treasury.
- **Direct transfers** to the contract.

### Owner withdrawal constraints
- `withdrawAGI` is **owner‑only** and **paused‑only**.
- The owner can **never** withdraw escrowed funds.
- To “sunset” the contract and withdraw all remaining AGI: all jobs must be fully settled so `lockedEscrow == 0`.

## Reputation system (as implemented)
Reputation growth uses a diminishing‑returns formula with a hard cap.

### Agent reputation points
When a job completes:
- `scaledPayout = job.payout / 1e18`
- `payoutPoints = (scaledPayout^3) / 1e5`
- `reputationPoints = log2(1 + payoutPoints * 1e6) + (completionTime / 10000)`

### Diminishing returns & cap
For each update:
- `newReputation = current + reputationPoints`
- `diminishingFactor = 1 + (newReputation^2 / 88888^2)`
- `diminished = newReputation / diminishingFactor`
- Final reputation is `min(diminished, 88888)`.

### Validator reputation
Only **approving validators** are paid and gain reputation. Each approving validator receives:
- `validatorPayout = totalValidatorPayout / approverCount`
- `validatorReputationGain = reputationPoints * validationRewardPercentage / 100`

Disapprovers do not receive payouts or reputation.

## Mainnet deployment constraints
### EIP‑170 bytecode cap
Ethereum mainnet enforces a **24,576‑byte** runtime bytecode limit (EIP‑170). The repository includes a test guard that asserts deployed bytecode remains within the configured safety margin (currently **24,575 bytes**, see `scripts/check-bytecode-size.js` and the “Bytecode size guard” test).

### How to check deployed bytecode size
After `truffle compile`, check the runtime bytecode length:
```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```
Or run the helper:
```bash
node scripts/check-bytecode-size.js
```

### Compiler and optimizer pinning (Truffle)
- **Solidity compiler**: `0.8.23` (pinned in `truffle-config.js`).
- **Optimizer**: enabled with `runs = 50`.
- **viaIR**: **disabled** (`viaIR: false`).
- **Metadata bytecode hash**: `none`.
- **Revert strings**: `strip`.
- **EVM version**: `london` (default unless overridden).

These settings are critical to keep bytecode within the EIP‑170 cap and to ensure deterministic verification.

## Build & verification (Truffle)
### Deterministic build & test
```bash
npm ci
npx truffle compile
npx truffle test --network test
```

### Deployment (Truffle migrations)
The deployment entrypoint is `migrations/2_deploy_contracts.js`, which reads constructor wiring from `migrations/deploy-config.js` and environment variables. For mainnet‑grade deployments:
```bash
npx truffle migrate --network mainnet
```

### Constructor arguments (AGIJobManager)
The constructor accepts:
1. `agiTokenAddress` (ERC‑20 used for escrow/payouts)
2. `baseIpfs` (base URI used when completion metadata lacks a scheme)
3. `ensConfig[0]` = ENS registry address
4. `ensConfig[1]` = NameWrapper address
5. `rootNodes[0]` = clubRootNode
6. `rootNodes[1]` = agentRootNode
7. `rootNodes[2]` = alphaClubRootNode
8. `rootNodes[3]` = alphaAgentRootNode
9. `merkleRoots[0]` = validatorMerkleRoot
10. `merkleRoots[1]` = agentMerkleRoot

### Verification
`truffle-plugin-verify` is configured in `truffle-config.js`. With `ETHERSCAN_API_KEY` set:
```bash
npx truffle run verify AGIJobManager --network mainnet
```
If you prefer Etherscan’s UI, use the Standard JSON Input with the same compiler settings above.

## Roles & permissions (summary)
| Role | Capabilities |
| --- | --- |
| Owner | Pause/unpause, parameter tuning, allowlists/blacklists, moderator management, `withdrawAGI`, `delistJob` |
| Moderator | Resolve disputes (`resolveDispute`, `resolveDisputeWithCode`) |
| Employer | Create jobs, cancel pre‑assignment, dispute, receive completion NFTs |
| Agent | Apply for jobs, request completion, receive payouts & reputation |
| Validator | Approve/disapprove completion (if allowlisted), receive payouts & reputation on approval |

## Known limitations / non‑economic notes
- `additionalAgentPayoutPercentage` is currently **unused** in settlement logic (reserved for future use).
- `contributeToRewardPool` **does not segregate funds**; contributions are treasury and owner‑withdrawable during pause.
- ENS/NameWrapper gating depends on external contracts; resolver lookups or wrapper ownership checks may fail if ENS configuration is incomplete or inconsistent.

## Sunsetting / migration runbook (operator guidance)
A safe wind‑down path:
1. **Pause** the contract to stop new activity.
2. Allow agents to **request completion** and validators/moderators to **settle disputes**.
3. Let **cancel/expire/finalize** paths clear all active jobs.
4. Verify `lockedEscrow == 0`.
5. **Withdraw** remaining treasury funds with `withdrawAGI`.
6. Deploy a v2 if needed and migrate off‑chain coordination.

## Testing status (local)
Commands executed and results:
- `npm ci` → **failed** on Linux because `fsevents@2.3.2` is macOS‑only (EBADPLATFORM).
- `npm install --omit=optional` → **succeeded** (used to proceed with Truffle).
- `npx truffle version` → **succeeded**.
- `npx truffle compile` → **succeeded** (no compiler warnings emitted).
- `npx truffle test` → **failed** (no local node at `http://127.0.0.1:8545`).
- `npx truffle test --network test` → **succeeded** (216 passing).

If CI requires a default `development` network, start Ganache on `127.0.0.1:8545` or set `--network test` explicitly.

## Glossary (selected)
- **Escrow**: AGI reserved for unsettled jobs (`lockedEscrow`).
- **Treasury**: AGI balance minus `lockedEscrow` (owner‑withdrawable only while paused).
- **Identity lock**: one‑way freeze of ENS/token/root‑node wiring.
- **Pause**: operator safety switch that blocks new activity but allows exits.
- **Completion request**: agent‑submitted metadata required before settlement or NFT minting.
