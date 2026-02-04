# Identity lock & treasury pause semantics

This document summarizes the operational trust model for **AGIJobManager** and clarifies how the identity wiring lock and pause state interact with treasury withdrawals and user exits.

## Business-operated marketplace model

AGIJobManager is an operator-run marketplace: the owner retains operational control (pausing, parameter updates, allowlist maintenance, and incident response) while user funds in escrow are protected by on-chain accounting. The contract is intentionally **not** a decentralized governance system; instead, it enforces strong safety invariants around escrow and identity wiring while allowing operational controls for the business operator.

## Escrow protection invariant

- **Escrowed funds are tracked by `lockedEscrow` and are never withdrawable** by the owner.
- Any attempt to withdraw more than the non-escrow balance reverts with `InsufficientWithdrawableBalance`.
- Escrow is released only through job settlement flows (completion, cancellation, expiration, dispute resolution).

## Treasury definition (owner-withdrawable during pause)

The treasury is defined as **all AGI held by the contract that is *not* locked in escrow**. This includes:

- Any remainder left after job settlement (rounding dust).
- Reward-pool contributions (`contributeToRewardPool`).
- Any direct transfers sent to the contract address.

Treasury withdrawals are **only allowed while paused** via `withdrawAGI`, and never touch escrowed balances.

## Pause semantics (brief withdrawal pause)

Pausing is intended to be a **brief, operator-initiated window** (e.g., to withdraw treasury funds) with minimal user disruption.

### Blocked while paused
- Job creation and onboarding: `createJob`, `applyForJob`.
- Validation and disputes: `validateJob`, `disapproveJob`, `disputeJob`.
- Marketplace entry: `listNFT`, `purchaseNFT`.
- Reward pool contributions: `contributeToRewardPool`.

### Allowed while paused
- **Completion submission**: assigned agents can call `requestJobCompletion` for valid, active jobs.
- **Marketplace exit**: sellers can call `delistNFT` to remove active listings.
- **Settlement exits**: `cancelJob`, `expireJob`, and `finalizeJob` still operate when their normal predicates are satisfied.
- **Owner withdrawals**: `withdrawAGI` is available only while paused.

These exceptions ensure users can complete or exit positions even during a brief treasury withdrawal pause.

## Identity wiring lock (not a governance lock)

The **identity wiring lock** permanently freezes only the identity-related wiring and does **not** freeze business operations.
It is an identity wiring lock (token/ENS/root nodes), not a governance lock, and it does not restrict treasury withdrawals or operational controls.

### Frozen by `lockIdentityConfiguration()`
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`

### Not frozen by the identity lock
- Pausing/unpausing
- Treasury withdrawals
- Job settlement or dispute resolution
- Blacklists and allowlists
- Economic parameters (thresholds, limits, review periods, payouts)
- Merkle root updates (`updateMerkleRoots`)

This lock is intended to **freeze identity wiring only**, allowing the operator to keep running the marketplace without being able to rewire identity primitives.

## Additional notes

- `additionalAgentPayoutPercentage` is **reserved for future use**; it is not currently used to modify settlement economics.
- Reward-pool contributions are treated as **treasury funds** and are owner-withdrawable during pause, subject to the escrow invariant.
