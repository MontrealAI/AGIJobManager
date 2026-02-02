# Minimal governance guide

This document enumerates **owner-only** and **moderator-only** actions, explains when they should be used (ideally never), and provides an incident runbook. The goal is a **configure-once** deployment with minimal ongoing intervention.

## Owner-only functions (when to use + risks)

**Emergency controls**
- `pause()` / `unpause()`
  - **Use:** incident response, suspected exploit, or dispute recovery.
  - **Risk:** pauses most user actions; extended pauses stall jobs.
- `resolveStaleDispute(jobId, employerWins)` *(requires paused)*
  - **Use:** dispute deadlock after `disputeReviewPeriod`.
  - **Risk:** owner can override resolution; use only as last resort.
- `withdrawAGI(amount)` *(requires paused)*
  - **Use:** withdraw surplus (non-escrowed) AGI.
  - **Risk:** mis-sizing reverts; never withdraw escrow (`lockedEscrow`).

**Role controls**
- `addModerator(address)` / `removeModerator(address)`
  - **Use:** rotate dispute arbiters.
  - **Risk:** no moderators = disputes stuck.
- `addAdditionalAgent(address)` / `removeAdditionalAgent(address)`
- `addAdditionalValidator(address)` / `removeAdditionalValidator(address)`
  - **Use:** emergency allowlist when ENS/Merkle gates block progress.
  - **Risk:** bypasses identity gating; reduces trust guarantees.
- `blacklistAgent(address,bool)` / `blacklistValidator(address,bool)`
  - **Use:** block malicious participants.
  - **Risk:** overuse can halt normal operations.

**Configuration (set once, then avoid)**
- `setRequiredValidatorApprovals(uint256)`
- `setRequiredValidatorDisapprovals(uint256)`
- `setValidationRewardPercentage(uint256)`
- `setMaxJobPayout(uint256)`
- `setJobDurationLimit(uint256)`
- `setCompletionReviewPeriod(uint256)`
- `setDisputeReviewPeriod(uint256)`
- `setPremiumReputationThreshold(uint256)`
- `setAdditionalAgentPayoutPercentage(uint256)` *(legacy; not used in payouts)*
- `setBaseIpfsUrl(string)`
- `updateTermsAndConditionsIpfsHash(string)`
- `updateContactEmail(string)`
- `updateAdditionalText1/2/3(string)`
- `addAGIType(address,uint256)`
  - **Use:** configure before launch; change rarely.
  - **Risk:** misconfiguration can make payouts revert if `agent + validator > 100`.

**Owner transfers**
- `transferOwnership(address newOwner)`
  - **Use:** move to multisig immediately after configuration.
  - **Risk:** wrong target locks governance.
- `renounceOwnership()`
  - **Use:** only if you accept **no** future interventions.

## Moderator-only functions

- `resolveDisputeWithCode(jobId, code, reason)`
  - **Use:** resolve disputes in favor of agent/employer.
  - **Risk:** incorrect resolution can permanently misallocate escrow.
- `resolveDispute(jobId, string)`
  - **Use:** deprecated; avoid unless required for legacy tooling.

## Incident runbook (practical steps)

1. **Pause** if active exploitation or unexpected behavior is detected.
2. **Assess scope**
   - Check `lockedEscrow`, `withdrawableAGI`, and pending disputes.
3. **Stabilize**
   - Add emergency allowlisted validators/agents if gating is blocking resolution.
4. **Resolve disputes**
   - Prefer moderator `resolveDisputeWithCode`.
   - Use `resolveStaleDispute` only if moderators are unavailable.
5. **Post-incident**
   - Unpause once invariants and parameters are validated.
   - Document actions, transaction hashes, and rationale.

## Immutable invariants (cannot be changed)

- **AGI token:** `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`
- **ENS roots:** `club.agi.eth` and `agent.agi.eth` (alpha roots derived on-chain)
