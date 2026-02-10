# Operations Runbook

## Monitoring checklist
Track these continuously:
- Contract AGI balance and `lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`.
- Job lifecycle events: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobDisputed`.
- Settlement/admin events: `DisputeResolvedWithCode`, `SettlementPauseSet`, `AGIWithdrawn`, `IdentityConfigurationLocked`.
- ENS hook quality: `EnsHookAttempted` success ratio.

## Insolvency guard
- `withdrawableAGI()` must remain callable and non-negative.
- If it reverts `InsolventEscrowBalance`, treat as critical incident.

## Pausing guidance
- Use `pause()` to stop new activity while preserving controlled exits/finalization logic where allowed.
- Use `setSettlementPaused(true)` only for severe containment; it blocks major settlement endpoints.
- Resume in two stages when possible: settlement first, then new job activity.

## Incident response playbooks
### ENS failures
- Symptom: `EnsHookAttempted(...,false)`.
- Action: validate ENSJobPages configuration; escrow logic can continue.

### Validator issues
- Symptom: low participation, ties, under-quorum disputes.
- Action: adjust thresholds/quorum and validator set operationally; use moderators for backlog.

### Unexpected reverts in settlement
- Action: inspect job state with `getJobCore/getJobValidation`; verify paused/settlementPaused and time windows.

### Key rotation / ownership transfer
- Use `transferOwnership(<NEW_SAFE_ADDRESS>)` under change-control.
- Pre-stage moderators and emergency operators.
- Validate ownership and pause controls after transfer.
