# Trust model and security overview

This document provides a concise, audit-focused reference for how AGIJobManager
is operated, what the owner can do, and the hard invariants enforced by the
contract. It is a business‑operated marketplace, not a DAO.

## 1) Trust model (owner‑operated marketplace)

AGIJobManager is an owner‑operated marketplace. Users must trust the owner and
moderators to operate honestly, while the contract enforces escrow accounting
and settlement invariants.

**Owner powers (as implemented)**
- **Pause/unpause** the marketplace.
- **Withdraw treasury** (non‑escrow balance) while paused only.
- **Manage allowlists/blacklists** for agents and validators.
- **Manage moderators** and AGI payout tiers (AGI types).
- **Adjust economic parameters** (validator thresholds, review periods, job
  duration limits, payout caps, and validation reward percentages).
- **Identity wiring before lock** (AGI token, ENS registry, NameWrapper, root
  nodes), and **Merkle roots at any time**.
- **Owner‑only job delist** for unassigned jobs.

**Best‑practice operations**
- Use a multisig for ownership.
- Monitor escrow solvency continuously.
- Maintain public incident reporting and change logs tied to emitted events.

## 2) Treasury vs escrow separation (hard invariant)

**Escrow** is the sum of outstanding job payouts tracked by `lockedEscrow`.
**Treasury** is any AGI held by the contract **above** `lockedEscrow`.

**Sources of treasury (as implemented)**
- Any payout remainder when `agentPayoutPct + validationRewardPercentage < 100`.
- Integer division rounding dust.
- `contributeToRewardPool` transfers (not segregated from treasury).
- Any direct token transfers to the contract.

**Withdrawal semantics**
- `withdrawableAGI()` returns `balance - lockedEscrow` and reverts on insolvency.
- `withdrawAGI(amount)` is **owner‑only** and **paused‑only**.

**Example**
- Contract balance: 1,000 AGI
- `lockedEscrow`: 700 AGI
- `withdrawableAGI()`: 300 AGI
- `withdrawAGI(400)` reverts; `withdrawAGI(300)` succeeds while paused.

## 3) Pause semantics (blocked vs allowed)

Pausing is intended to stop new risk while preserving exits/settlement.

**Blocked while paused**
| Category | Functions |
| --- | --- |
| Job creation & onboarding | `createJob`, `applyForJob` |
| Validation & dispute entry | `validateJob`, `disapproveJob`, `disputeJob` |
| Marketplace entry | `listNFT`, `purchaseNFT` |
| Reward pool funding | `contributeToRewardPool` |

**Allowed while paused**
| Category | Functions |
| --- | --- |
| Completion submission | `requestJobCompletion` |
| Settlement & exits | `cancelJob`, `expireJob`, `finalizeJob` |
| Dispute resolution | `resolveDispute`, `resolveDisputeWithCode` |
| Owner recovery | `resolveStaleDispute` (owner‑only, paused‑only) |
| Marketplace exit | `delistNFT` |
| Owner job delist | `delistJob` (owner‑only, unassigned only) |
| Treasury withdrawal | `withdrawAGI` (owner‑only, paused‑only) |

**Rationale**: Pause is used to halt new obligations and risky actions, not to
trap users or prevent settlement/exit paths.

## 4) Identity configuration lock (scope and guarantees)

`lockIdentityConfiguration()` is a one‑way switch that freezes **identity wiring**
only; it is not a governance lock.

**Locked once set**
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`

**Not locked**
- `updateMerkleRoots` (allowlist roots remain adjustable).
- Operational controls (pause/unpause, allowlists/blacklists, parameter tuning).
- Treasury withdrawals and dispute resolution.

**Pre‑lock constraints**
Even before locking, identity wiring updates require **no jobs created** and
**no escrow outstanding** (`nextJobId == 0` and `lockedEscrow == 0`).

## 5) Reputation system overview

- Agent reputation is updated only on successful completion paths.
- The points calculation is **log‑scaled** from payout and time, then
  **diminished** by a quadratic factor and **capped** at `88888`.
- Validator reputation increases only for approving validators.
- There is **no slashing or decay** mechanism.
- Premium access is a simple threshold check via `premiumReputationThreshold`.

## 6) Notes on unused or future knobs

- `additionalAgentPayoutPercentage` is **not used** in settlement logic today.
- “Reward pool” contributions are **not segregated**; they are part of the
  contract balance and therefore treasury (subject to escrow protections).
