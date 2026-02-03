# Governance-Minimal Operations

This guide enumerates **owner-only controls**, when they should be used, and the risks of using them. The intent is **configure once**, then restrict governance to emergencies.

## Owner-only functions (and intended usage)

> **Legend:** ✅ = acceptable emergency use, ⚠️ = avoid in steady state.

### Emergency controls
- ✅ `pause()` / `unpause()`
  - **Use:** incident response, settlement safety, or recovery workflows.
  - **Risk:** halts most user actions; can create liveness delays if abused.
- ✅ `resolveStaleDispute(jobId, employerWins)`
  - **Use:** recovery when disputes remain unresolved past `disputeReviewPeriod` (only while paused).
  - **Risk:** centralizes settlement; use sparingly and with audit trail.
- ✅ `withdrawAGI(amount)` (paused only)
  - **Use:** withdraw **surplus** only; never touch escrowed funds.
  - **Risk:** incorrect sizing reverts; do not drain funds needed for active jobs.

### Role management
- ⚠️ `addModerator()` / `removeModerator()`
  - **Use:** rotate trusted dispute arbiters.
  - **Risk:** no moderators = disputes can deadlock.
- ⚠️ `blacklistAgent()` / `blacklistValidator()`
  - **Use:** emergency abuse mitigation.
  - **Risk:** can halt jobs if used broadly.
- ⚠️ `addAdditionalAgent()` / `removeAdditionalAgent()`
- ⚠️ `addAdditionalValidator()` / `removeAdditionalValidator()`
  - **Use:** recovery when ENS/Merkle gating is misconfigured or delayed.
  - **Risk:** bypasses normal identity checks; keep limited and time-bound.

### Parameter setters (configure once)
- ⚠️ `setRequiredValidatorApprovals()` / `setRequiredValidatorDisapprovals()`
  - **Use:** pre-launch tuning only.
  - **Risk:** unreachable thresholds can stall jobs.
- ⚠️ `setValidationRewardPercentage()`
  - **Use:** pre-launch tuning only.
  - **Risk:** combined payouts > 100% will revert job completion.
- ⚠️ `setMaxJobPayout()` / `setJobDurationLimit()`
  - **Use:** pre-launch sizing only.
  - **Risk:** extreme values can break job creation or reputation math.
- ⚠️ `setCompletionReviewPeriod()` / `setDisputeReviewPeriod()`
  - **Use:** pre-launch tuning only.
  - **Risk:** too short or too long can harm liveness.
- ⚠️ `setPremiumReputationThreshold()`
  - **Use:** policy adjustments only (no settlement risk).
- ⚠️ `setAdditionalAgentPayoutPercentage()`
  - **Use:** legacy value only; **not** used in payouts.
- ⚠️ `setBaseIpfsUrl()`
  - **Use:** only when metadata hosting changes.
  - **Risk:** may break NFT metadata display (not escrow logic).
- ⚠️ `updateTermsAndConditionsIpfsHash()` / `updateContactEmail()` / `updateAdditionalText1/2/3()`
  - **Use:** metadata updates only.

### AGI type management
- ⚠️ `addAGIType(nftAddress, payoutPercentage)`
  - **Use:** set payout tiers before launch; update rarely.
  - **Risk:** payout tiers + validator reward > 100% will revert completion.

### Ownership controls
- ✅ `transferOwnership(newOwner)`
  - **Use:** move governance to multisig/timelock after setup.
- ⚠️ `renounceOwnership()`
  - **Use:** only if you accept **no future emergency actions**.

## Incident runbook (practical)

1. **Pause** the contract if there is a transfer failure, exploit risk, or dispute deadlock.
2. **Diagnose** the root cause:
   - Check `lockedEscrow`, `withdrawableAGI`, and job state.
   - Verify ENS resolver/NameWrapper status (watch `RecoveryInitiated` events).
   - Confirm validator thresholds are reachable.
3. **Resolve disputes**:
   - Moderators use `resolveDisputeWithCode`.
   - If moderators are inactive and the dispute is stale, the owner uses `resolveStaleDispute`.
4. **Recover liveness**:
   - Reduce validator thresholds if necessary.
   - Temporarily add allowlisted agents/validators for recovery.
5. **Unpause** after state is stable and actions are verified.

## Governance minimization recommendations

- Transfer ownership to a multisig/timelock immediately after configuration.
- Maintain a small, accountable moderator set.
- Avoid runtime parameter changes unless an incident justifies them.
