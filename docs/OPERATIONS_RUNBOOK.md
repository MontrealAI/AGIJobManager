# Operations Runbook

## Monitoring checklist
Watch events and derived balances:
- Job lifecycle: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobCancelled`
- Disputes: `JobDisputed`, `DisputeResolvedWithCode`
- Risk controls: `SettlementPauseSet`, `IdentityConfigurationLocked`
- Treasury: `PlatformRevenueAccrued`, `AGIWithdrawn`

Track solvency continuously:
- `AGI balance of contract`
- `lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`
- Alert if balance approaches locked total.

## Pause guidance
- `pause()` stops create/apply/vote/dispute entrypoints guarded by `whenNotPaused`.
- `setSettlementPaused(true)` halts settlement/cancel/expire/finalize/withdraw paths using `whenSettlementNotPaused`.
- Use both for incident containment; lift in reverse after triage.

## Incident response

### ENS integration failures
Symptoms: `EnsHookAttempted(...,success=false)`.
- Core settlement should still continue.
- Validate ENSJobPages config and external ENS permissions.
- Backfill ENS metadata manually if needed.

### Validator liveness issues
Symptoms: persistent low participation or repeated under-quorum disputes.
- Tune thresholds/quorum carefully.
- Expand validated allowlist/Merkle set.
- Consider temporary moderator handling patterns.

### Unexpected reverts
- Decode custom errors from tx traces.
- Check pause state, settlement pause, and window deadlines.
- Validate token approvals for escrow and bonds.

### Insolvency revert (`InsolventEscrowBalance`)
- Stop treasury withdrawals.
- Reconcile all incoming/outgoing AGI transfers.
- Restore contract balance above locked totals before resuming normal ops.

## Key management
- Owner should be a multisig, not EOAs.
- Moderator set changes should be change-managed and logged.
- For owner rotation, transfer ownership during a controlled paused window with sign-off.

## Routine operational checks
- Daily: solvency dashboard and dispute backlog.
- Weekly: parameter drift review vs approved config baseline.
- Monthly: dry-run incident response playbook on testnet.
