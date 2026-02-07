# Operator runbook

This runbook is for the **owner/operator** of AGIJobManager. It focuses on
safe day‑to‑day operations, emergency procedures, and monitoring.

## Day‑to‑day operations

### 1) Pause / unpause
**Use when**: incident response, parameter change review, treasury withdrawal.

- `pause()` blocks new activity but preserves settlement exits.
- `unpause()` restores normal operations.

### 2) Treasury withdrawals (owner‑only, paused‑only)
**Process**
1. **Pause** the contract.
2. Check `withdrawableAGI()` = `balance - lockedEscrow - lockedAgentBonds - lockedValidatorBonds`.
3. Withdraw up to `withdrawableAGI()` using `withdrawAGI(amount)`.
4. **Unpause** after confirming balances.

### 3) Blacklisting / allowlisting
- Use `blacklistAgent` / `blacklistValidator` for emergency removals.
- Use `addAdditionalAgent` / `addAdditionalValidator` for explicit overrides.
- Rotate Merkle roots when a broad allowlist update is required.

### 4) Moderator management
- Add or remove moderators with `addModerator` / `removeModerator`.
- Keep a published roster of active moderators.

### 5) Parameter changes
- Use `setRequiredValidatorApprovals` / `setRequiredValidatorDisapprovals` to
  adjust thresholds.
- Adjust duration and review period parameters with caution; changes affect
  in‑flight jobs.
- Update `validationRewardPercentage` only when payout headroom is safe.

## Emergency playbooks

### A) Critical bug discovered
1. **Pause** immediately.
2. Assess `lockedEscrow` vs token balance (solvency check).
3. Review in‑flight jobs for settlement impact.
4. Communicate status and expected timeline publicly.
5. Decide whether to resolve disputes or exit jobs before redeploying.

### B) Dispute backlog
1. Review `JobDisputed` events and age.
2. Prioritize by `disputedAt` and payout size.
3. Resolve with `resolveDisputeWithCode` when evidence is sufficient.
4. Use `resolveStaleDispute` only after the dispute review period (pause
   optional; often used during incident response).

## Monitoring checklist

**Core invariants**
- `agiToken.balanceOf(contract) >= lockedEscrow`
- `withdrawableAGI()` does not revert

**Events to index and alert**
- **Lifecycle**: `JobCreated`, `JobApplied`, `JobCompletionRequested`,
  `JobValidated`, `JobDisapproved`, `JobCompleted`, `JobFinalized`,
  `JobExpired`, `JobCancelled`
- **Disputes**: `JobDisputed`, `DisputeResolved`, `DisputeResolvedWithCode`,
  `DisputeTimeoutResolved`
- **NFT issuance**: `NFTIssued`
- **Treasury/ops**: `AGIWithdrawn`, `Paused`, `Unpaused`, `RewardPoolContribution`
- **Identity**: `IdentityConfigurationLocked`, `RootNodesUpdated`,
  `MerkleRootsUpdated`, `EnsRegistryUpdated`, `NameWrapperUpdated`
- **Blacklists**: `AgentBlacklisted`, `ValidatorBlacklisted`

## Operational notes

- Pause is designed to stop new risk while preserving settlement and exit paths.
- Identity wiring should be locked once validated in production.
- Avoid changing validator thresholds mid‑cycle unless required for safety.
