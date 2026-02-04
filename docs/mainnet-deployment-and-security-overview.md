# AGIJobManager – Mainnet Deployment & Security Overview

## What this contract is
AGIJobManager is an **owner-operated** on-chain escrow and settlement contract for employer/agent jobs with validator approvals, dispute resolution, reputation tracking, and a tightly scoped ERC-721 job NFT marketplace. It is not a trustless protocol or DAO; the owner and moderators retain operational control while the contract enforces escrow and settlement invariants.

**Roles**
- **Owner**: operational control (pause/unpause, parameter tuning, allowlists/blacklists, moderator management, treasury withdrawal while paused).
- **Moderator**: dispute resolution authority.
- **Employer**: creates jobs, funds escrow, cancels unassigned jobs, disputes.
- **Agent**: applies for jobs, requests completion, earns payout + reputation, receives completion NFT.
- **Validator**: approves/disapproves completion, earns payout + reputation on approval.

## Trust model (owner-operated marketplace)
AGIJobManager is a centralized operational system with on-chain escrow guarantees. Users must trust:
- **Owner integrity** to pause/unpause appropriately, tune parameters, maintain allowlists/blacklists, and operate within documented withdrawal bounds.
- **Moderator integrity** to resolve disputes fairly.
- **Escrow accounting** to prevent owner withdrawal of unsettled funds via `lockedEscrow` and `withdrawableAGI()` invariants.

This is an owner-operated marketplace with enforced escrow, not a decentralized court or DAO.

## Identity wiring lock (`lockIdentityConfig`)
The contract exposes a one-way identity configuration lock, gated by `lockIdentityConfiguration()` and the `lockIdentityConfig` flag. It is intended to freeze identity wiring after initial setup.

### Frozen by the lock
Once `lockIdentityConfiguration()` is called, the following **cannot** be updated:
- `updateAGITokenAddress` (ERC-20 escrow token address)
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`

**Pre-lock constraints**: even before the lock is set, the identity wiring functions above require **no jobs to exist** (`nextJobId == 0`) and **no escrowed funds** (`lockedEscrow == 0`).

### Not frozen by the lock
The lock **does not** restrict:
- Operational controls (pause/unpause, allowlists/blacklists, parameter tuning)
- Treasury withdrawals (`withdrawAGI`, owner-only, paused-only)
- Job settlement flows
- **Merkle root updates** (`updateMerkleRoots` remains allowed)

### Recommended operational sequence
Deploy → configure ENS/token/root nodes → confirm wiring → lock identity config → operate.

## Pause semantics (blocked vs allowed)
Pause is an incident-response control intended to halt new activity without trapping exits.

### Blocked while paused
| Category | Functions |
| --- | --- |
| Job creation & onboarding | `createJob`, `applyForJob` |
| Validation & dispute entry | `validateJob`, `disapproveJob`, `disputeJob` |
| Marketplace entry | `listNFT`, `purchaseNFT` |
| Reward pool funding | `contributeToRewardPool` |

### Allowed while paused
| Category | Functions |
| --- | --- |
| Completion request | `requestJobCompletion` (assigned agent only) |
| Settlement & exits | `cancelJob`, `expireJob`, `finalizeJob`, `resolveDispute`, `resolveDisputeWithCode` |
| Owner recovery | `resolveStaleDispute` (owner-only, paused-only) |
| Marketplace exit | `delistNFT` (seller-only) |
| Owner delist | `delistJob` (owner-only; unassigned only) |
| Treasury withdrawal | `withdrawAGI` (owner-only, paused-only) |

**Explicit exceptions:** agents may still request completion while paused, and NFT sellers may delist while paused.

## Treasury vs escrow (withdrawal rules)
- **Escrow**: job payout deposits tracked by `lockedEscrow`.
- **Treasury**: AGI balance **minus** `lockedEscrow` (owner-withdrawable only while paused).

### `withdrawableAGI()` invariant
`withdrawableAGI()` returns `balance - lockedEscrow` and **reverts** if `balance < lockedEscrow` (escrow insolvency is not allowed).

### `withdrawAGI()` gating
- **Owner-only** and **paused-only**.
- **Cannot exceed** `withdrawableAGI()`.
- **Never withdraws escrowed funds**.

**Example**: if the contract holds **1,000 AGI** and `lockedEscrow` is **800 AGI**, then `withdrawableAGI()` is **200 AGI**. The owner can withdraw at most **200 AGI** while paused.

### Shutdown / migration note
To withdraw all AGI, `lockedEscrow` must reach **0** through job settlement, cancellation, expiry, or refunds. There is no owner sweep of escrowed funds.

## Reputation system (as implemented)
Reputation grows with diminishing returns and a hard cap.

### Agent reputation points
On completion:
- `scaledPayout = job.payout / 1e18`
- `payoutPoints = (scaledPayout^3) / 1e5`
- `reputationPoints = log2(1 + payoutPoints * 1e6) + (completionTime / 10000)`

### Diminishing returns & cap
- `newReputation = current + reputationPoints`
- `diminishingFactor = 1 + (newReputation^2 / 88888^2)`
- `diminished = newReputation / diminishingFactor`
- Final reputation is `min(diminished, 88888)`.

### Validator reputation and payouts
Only **approving validators** receive payouts and reputation. Each approver receives:
- `validatorPayout = totalValidatorPayout / approverCount`
- `validatorReputationGain = reputationPoints * validationRewardPercentage / 100`

Disapprovers receive no payout or reputation.

## Mainnet deployment constraints
### EIP-170 bytecode cap
Ethereum mainnet enforces a **24,576-byte** runtime bytecode limit (EIP-170). The test suite includes a **Bytecode size guard** that asserts the deployed bytecode remains within the configured safety margin.

### How to check deployed bytecode size
After `truffle compile`, check runtime bytecode length:
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

These settings are required to keep bytecode within the EIP-170 cap and to ensure deterministic verification.

## Build, deploy, verify (Truffle)
### Deterministic build & test
```bash
npm ci
npx truffle compile
npx truffle test --network test
```

### Deployment (Truffle migrations)
The deployment entrypoint is `migrations/2_deploy_contracts.js`, which reads constructor wiring from `migrations/deploy-config.js` and environment variables. For mainnet-grade deployments:
```bash
npx truffle migrate --network mainnet
```

### Constructor arguments (AGIJobManager)
1. `agiTokenAddress` (ERC-20 used for escrow/payouts)
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
If you prefer Etherscan’s UI, use the Standard JSON Input with the same compiler settings above and the constructor arguments listed here.

## Known limitations / explicit non-features
- `additionalAgentPayoutPercentage` is currently **unused** in settlement logic (reserved for future use).
- `contributeToRewardPool` **does not segregate funds**; contributions become treasury and are owner-withdrawable during pause.
- There is **no token rescue** function for arbitrary ERC-20s or ERC-721s; avoid sending non-AGI tokens directly to the contract.
- ENS/NameWrapper gating depends on external ENS contracts; misconfiguration or resolver changes can cause allowlist failures.

## Testing status (local)
Commands executed and results:
- `npm ci` → **failed** on Linux because `fsevents@2.3.2` is macOS-only (EBADPLATFORM).
- `npm install --omit=optional` → **succeeded** (used to proceed with Truffle).
- `npx truffle version` → **succeeded**.
- `npx truffle compile` → **succeeded** (no compiler warnings emitted).
- `npx truffle test` → **failed** (no local node at `http://127.0.0.1:8545`).
- `npx truffle test --network test` → **succeeded** (216 passing).

**Next fix when `npx truffle test` fails**: start Ganache on `127.0.0.1:8545` (e.g., `npx ganache -p 8545`) or run `npx truffle test --network test`.

## Glossary (selected)
- **Escrow**: AGI reserved for unsettled jobs (`lockedEscrow`).
- **Treasury**: AGI balance minus `lockedEscrow` (owner-withdrawable only while paused).
- **Identity lock**: one-way freeze of ENS/token/root-node wiring (`lockIdentityConfig`).
- **Pause**: operator safety switch that blocks new activity but allows exits.
- **Completion request**: agent-submitted metadata required before settlement or NFT minting.
