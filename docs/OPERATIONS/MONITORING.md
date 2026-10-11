# Monitoring

## Events catalog

| Event | When emitted | Monitor for | Suggested alert |
| --- | --- | --- | --- |
| `JobCreated` | New escrowed job | New liability | Info / volume baseline |
| `JobApplied` | Agent assigned | Bond lock increment | Unexpected actor |
| `JobCompletionRequested` | Completion enters review | Review timer start | Missing follow-up vote |
| `JobValidated` / `JobDisapproved` | Validator vote | Vote concentration / Sybil patterns | High disagreement spike |
| `JobDisputed` | Dispute opened | Frozen validator lane | Immediate moderation queue |
| `DisputeResolvedWithCode` | Moderator resolution | Outcome integrity | Critical if unusual resolution code |
| `JobCompleted` / `JobExpired` / `JobCancelled` | Terminal state | Liability release | Reconciliation check |
| `USDCWithdrawn` | Treasury withdrawal | Owner action trace | High-severity if unscheduled |
| `SettlementPauseSet` | Settlement mode toggle | Incident state transitions | High-severity |

## Recommended dashboard blocks

- Outstanding jobs by state and age buckets.
- Locked accounting totals versus token balance.
- Dispute backlog and resolution latency.
- Validator participation distribution.

## Error telemetry

Capture revert/error frequencies from RPC traces for:
`InvalidState`, `SettlementPaused`, `ValidatorLimitReached`, and `InsufficientWithdrawableBalance`.

## Recorded-instance commissioning and response

Use [the supported commands](COMMISSIONING.md) for canonical-block current observations and bounded wallet approval history. Preserve historical reports and append new observations. Rehearse an alert through the actual funded response signer; record detection time, decision, response and recovery evidence privately. A stopped launcher overrides a passing child. Review root operators and child resolver delegates separately. `pauseIntake()` contains new creation/assignment; `pauseAll()` also stops settlement paths including refunds/claims and affects lifecycle-clock handling. Configuration locking is not incident response.
