# Operations Runbook

## Purpose
Safe day-2 operation guidance for AGIJobManager in production.

## Audience
On-call operators, security response, and maintainers.

## Monitoring Baseline
### Critical metrics
- `agiToken.balanceOf(contract)`
- `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`
- paused states: `paused()`, `settlementPaused`

### Events to index
- Throughput/lifecycle: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`
- Risk queue: `JobDisputed`, `DisputeResolvedWithCode`
- Governance controls: `SettlementPauseSet`, `IdentityConfigurationLocked`, `AGIWithdrawn`
- ENS health: `EnsHookAttempted`

## Alert Conditions
- Insolvency signal: `withdrawableAGI()` reverts with `InsolventEscrowBalance`.
- Backlog signal: old active disputes exceed `disputeReviewPeriod`.
- Availability signal: spike in settlement reverts or persistent paused state.
- Metadata signal: elevated `EnsHookAttempted(...,success=false)` ratio.

## Incident Response
### ENS hook failures
1. Confirm `ensJobPages` address code exists.
2. Validate root ownership/approvals and resolver.
3. Keep settlement running; treat as metadata degradation.

### Validator misbehavior / low turnout
1. Evaluate thresholds/quorum parameters.
2. Use moderator dispute lane for stuck jobs.
3. Schedule controlled parameter changes (prefer paused creation flow during updates).

### Configuration error
1. Pause if blast radius unclear.
2. Verify current config via `scripts/verify-config.js`.
3. Roll forward with corrected transactions and document every tx hash.

## Safe Pausing Procedure
1. Announce maintenance window.
2. `pause()` to stop new participation.
3. If needed for containment, `setSettlementPaused(true)`.
4. Execute remediation.
5. Restore settlement first, then new activity.

## Key Management / Ownership Transfer
- Use multisig as owner.
- Rotation procedure:
  1. Stage signers.
  2. `transferOwnership(<NEW_SAFE_ADDRESS>)`.
  3. Verify `owner()`.
  4. Test pause/unpause authority.

## Gotchas
- `withdrawAGI` requires `paused == true` and `settlementPaused == false`.
- Locking identity config does not remove owner/moderator powers.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../scripts/verify-config.js`](../scripts/verify-config.js)
