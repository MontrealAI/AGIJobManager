# AGIJobManager Security Considerations

This document summarizes security posture, fixed issues, and remaining risks based on the current implementation.

## Reentrancy posture

The contract inherits `ReentrancyGuard` and applies `nonReentrant` to state‑changing functions that handle funds or sensitive transitions, including:
- Job escrow and settlement (`createJob`, `finalizeJob`, `cancelJob`, `expireJob`).
- Validation and dispute resolution (`validateJob`, `disapproveJob`, `disputeJob`, `resolveDispute`, `resolveDisputeWithCode`, `resolveStaleDispute`).
- Funds management (`withdrawAGI`, `contributeToRewardPool`).

Functions without `nonReentrant` (e.g., `requestJobCompletion`) do not transfer funds and only update job metadata.

## Fixed issues vs. legacy v0

The contract explicitly addresses common issues observed in earlier variants:

- **Phantom job IDs / takeover**: `_job` reverts when the job’s employer is the zero address. This prevents interacting with deleted or nonexistent job records.
- **Double voting by validators**: `approvals` and `disapprovals` mappings enforce single‑vote behavior, and the contract reverts if a validator tries to vote twice or vote on both sides.
- **Division by zero on validator payouts**: validator payouts are only computed if `validators.length > 0`; otherwise, validator payout is zero.
- **Employer‑win double completion**: `_refundEmployer` marks the job as completed and releases escrow, preventing additional settlement paths.
- **Unchecked ERC‑20 transfers**: `_callOptionalReturn` and `_safeERC20TransferFromExact` enforce successful transfers and exact amount receipt; fee‑on‑transfer or non‑standard tokens will revert.
- **Validator bonds & slashing**: bonded voting is accounted via `lockedValidatorBonds` and released on settlement; incorrect votes are slashed, while correct votes receive rewards.

## Remaining risks and assumptions

- **Owner centralization**: the owner can pause/unpause, modify parameters, update the escrow token, add AGI types, and withdraw surplus funds. A compromised owner can disrupt or redirect flows.
- **Moderator trust**: moderators can unilaterally decide disputes. There is no on‑chain appeal mechanism.
- **External dependencies**: ENS, NameWrapper, and Resolver contracts are trusted for ownership validation.
- **Merkle root management**: Merkle roots are set at deployment but can be updated by the owner via `updateMerkleRoots`. Incorrect roots can be corrected without redeploying; use explicit allowlists for urgent recovery while governance approves an update.
- **ERC‑20 behavior assumptions**: the token must return `true` on transfers or provide no return data, and it must transfer exact amounts (no transfer fees). Fee‑on‑transfer tokens are incompatible.
- **Escrow solvency**: `withdrawableAGI` reverts if the contract balance is below `lockedEscrow`. Operators must avoid draining escrowed funds by mistake.

## Recommended best practices

- Use multi‑sig ownership and rotate moderators periodically.
- Monitor `lockedEscrow` and ensure the contract’s ERC‑20 balance never drops below it.
- Ensure validator thresholds, AGI type percentages, and validation reward percentage maintain `agentPayoutPct + validationRewardPercentage <= 100`.
- Prefer explicit allowlisting when ENS/Merkle configuration is uncertain.
