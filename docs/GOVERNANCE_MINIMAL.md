# Minimal governance guide

This document enumerates **owner‑only** functions, the expected usage frequency, and the operational risk of each. The goal is **configure once, then operate with minimal governance**.

## Owner‑only functions (grouped by intent)

### Configure‑once parameters (set immediately post‑deploy)
Use these once after deployment and then avoid routine changes.

- **Validator thresholds**
  - `setRequiredValidatorApprovals(uint256)`
  - `setRequiredValidatorDisapprovals(uint256)`
  - **Risk if mis‑set:** jobs stall or disputes never trigger.
- **Payout economics**
  - `setValidationRewardPercentage(uint256)`
  - `addAGIType(address nftAddress, uint256 payoutPercentage)`
  - **Risk if mis‑set:** settlement can revert if total payout > escrow.
- **Lifecycle limits**
  - `setMaxJobPayout(uint256)`
  - `setJobDurationLimit(uint256)`
  - `setCompletionReviewPeriod(uint256)`
  - `setDisputeReviewPeriod(uint256)`
  - **Risk if mis‑set:** premature timeouts or long‑lived escrow.
- **Feature gating**
  - `setPremiumReputationThreshold(uint256)`
  - **Risk if mis‑set:** affects premium access only.
- **Legacy config (avoid using)**
  - `setAdditionalAgentPayoutPercentage(uint256)` — retained for compatibility; does **not** affect payouts.

### Role & allowlist controls (use sparingly)
Use only to recover from mis‑configured identity gating or to respond to abuse.

- **Moderators**
  - `addModerator(address)`
  - `removeModerator(address)`
  - **Risk:** no moderators → disputes cannot resolve.
- **Allowlists**
  - `addAdditionalAgent(address)` / `removeAdditionalAgent(address)`
  - `addAdditionalValidator(address)` / `removeAdditionalValidator(address)`
  - **Risk:** overuse weakens identity guarantees; underuse can stall jobs.
- **Blacklists**
  - `blacklistAgent(address, bool)`
  - `blacklistValidator(address, bool)`
  - **Risk:** can halt job progress if critical participants are blocked.

### Emergency controls (keep available)
Use only during incidents or recovery.

- `pause()` / `unpause()` — pauses most user actions.
- `resolveStaleDispute(uint256 jobId, bool employerWins)` — **owner‑only while paused**, after `disputeReviewPeriod`.
- `delistJob(uint256 jobId)` — owner cancellation if job is unassigned.
- `withdrawAGI(uint256 amount)` — withdraw **surplus** only, while paused.

### Metadata (low‑risk updates)
- `updateTermsAndConditionsIpfsHash(string)`
- `updateContactEmail(string)`
- `updateAdditionalText1/2/3(string)`

These do not affect settlement, but should still be changed rarely and with audit logs.

## Runbook: incident response

1. **Pause immediately**
   - Call `pause()` to stop new lifecycle actions.
2. **Identify root cause**
   - Check thresholds, validator/agent allowlists, and Merkle/ENS gating.
3. **Apply minimal fix**
   - Adjust thresholds **once** if they are unreachable.
   - Add temporary allowlisted addresses if ENS/Merkle proofs are blocked.
4. **Resolve disputes if necessary**
   - Moderators call `resolveDisputeWithCode`.
   - If moderators are unavailable, use `resolveStaleDispute` after the review window (paused).
5. **Unpause**
   - Call `unpause()` only after the system is stable.

## Non‑governable invariants (cannot be changed)

- **AGI token address** is fixed to `0xA61a…`.
- **ENS roots** are fixed to `club.agi.eth` and `agent.agi.eth`.
- `validatorMerkleRoot` and `agentMerkleRoot` are constructor‑only.
