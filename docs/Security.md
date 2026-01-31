# Security model and limitations

This document summarizes security considerations specific to the current `AGIJobManager` contract. It should be read alongside the test suite and interface reference.

## Threat model overview

**Assets at risk**
- Escrowed ERC‑20 funds held by the contract.
- Job NFTs minted on completion.
- Reputation mappings used for premium access gating.

**Primary trust assumptions**
- **Owner powers**: can pause flows, update token address, thresholds, allowlists/blacklists, metadata fields, add AGI types, and withdraw ERC‑20 escrow.
- **Moderator powers**: resolve disputes with arbitrary strings. Only the canonical strings `agent win` and `employer win` trigger on-chain payout or refund.
  - These strings are case-sensitive; any other resolution clears the dispute flag without settlement actions.
- **Validator set**: validators are allowlisted or ENS/Merkle‑gated; the contract does not enforce decentralization.

## Hardened improvements (vs. historical v0)
The regression suite documents the following safer behaviors in the current contract:
- **Phantom job IDs blocked**: `_job` rejects non-existent jobs.
- **Pre-apply takeover blocked**: agents cannot claim assignments before a job exists.
- **Double completion blocked**: employer-win dispute resolution closes the job.
- **Division-by-zero avoided**: agent-win disputes complete safely when no validators voted.
- **Validator double-votes blocked**: validators cannot both approve and disapprove the same job.
- **Transfer checks enforced**: ERC‑20 transfers must return true or the call reverts.
- **Failed refunds revert**: `cancelJob` and refunds do not silently drop escrow.

See [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md) for details.

## Reentrancy posture
`ReentrancyGuard` is applied to:
- `createJob`, `applyForJob`, `validateJob`, `disapproveJob`, `disputeJob`, `resolveDispute`, `cancelJob`, `withdrawAGI`, `contributeToRewardPool`, `purchaseNFT`.

Functions without `nonReentrant` include `requestJobCompletion`, `listNFT`, and `delistNFT`. `purchaseNFT` uses `transferFrom` (ERC‑20) and `_transfer` (ERC‑721) rather than `safeTransferFrom`.
Marketplace purchases are guarded because `purchaseNFT` crosses an external ERC‑20 `transferFrom` boundary before transferring the ERC‑721.

## Known limitations and assumptions
- **Root immutability**: there are no on-chain setters for root nodes or Merkle roots after deployment. Misconfiguration requires redeployment.
- **ENS dependency**: ownership checks rely on ENS registry, NameWrapper, and resolver behavior.
- **ERC‑20 compatibility**: transfers must either return `true` or return no data; calls that revert, return `false`, or return malformed data revert.
- **Agent payout can be zero**: if no AGI type applies, the agent payout percentage is zero and residual funds remain in the contract.
- **Validator payout sharing**: all validators who voted share equally; there is no weighting or slashing.
- **Validator cap**: each job records at most `MAX_VALIDATORS_PER_JOB` unique validators to bound settlement gas. Owner-set thresholds must fit within this cap (each ≤ cap and approvals + disapprovals ≤ cap) to keep completion/dispute reachable without exceeding the loop bound.
- **Owner-controlled parameters**: thresholds and limits can be changed post-deployment by the owner.
- **Time enforcement gap**: only `requestJobCompletion` enforces job duration; validators can still approve/disapprove after the deadline unless off‑chain policy prevents it.

## Operational monitoring
- Index and alert on `JobDisputed`, `DisputeResolved`, `JobCompleted`, and `ReputationUpdated` events.
- Track `OwnershipVerified` and `RecoveryInitiated` to monitor ENS/Merkle ownership checks and fallbacks.

## Disclosure
Report security issues privately via [`SECURITY.md`](../SECURITY.md).
