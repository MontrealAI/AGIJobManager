# Events and Errors Reference

Source: [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol).

## Events catalog

| Event | Usage | Monitoring note |
| --- | --- | --- |
| `JobCreated` | New escrow job | Track liability creation |
| `JobApplied` | Agent assignment | Track bond lock changes |
| `JobCompletionRequested` | Completion submitted | Start review timers |
| `JobValidated` / `JobDisapproved` | Validator votes | Detect participation anomalies |
| `JobDisputed` | Dispute opened | Escalate moderator queue |
| `DisputeResolvedWithCode` | Moderator decision | Audit resolution codes/reasons |
| `JobCompleted` / `JobExpired` / `JobCancelled` | Terminal outcomes | Reconcile accounting releases |
| `AGIWithdrawn` | Treasury action | High-priority governance alert |
| `SettlementPauseSet` | Settlement control changed | Incident-state signal |
| `IdentityConfigurationLocked` | Wiring lock invoked | One-way governance milestone |

## Errors catalog

| Error | Likely cause | Remediation |
| --- | --- | --- |
| `NotModerator` | Non-moderator dispute resolution attempt | Use authorized moderator signer |
| `NotAuthorized` | Missing role/privilege | Verify actor permissions |
| `Blacklisted` | Actor is blacklisted | Review blacklist policy case |
| `InvalidParameters` | Out-of-range/invalid configuration | Validate with ops script |
| `InvalidState` | Lifecycle mismatch | Check job state getters |
| `JobNotFound` | Invalid `jobId` | Confirm creation and indexing |
| `TransferFailed` | Token transfer issue | Verify approvals/balances/token behavior |
| `SettlementPaused` | Owner paused settlement lane | Follow incident runbook |
| `InsufficientWithdrawableBalance` | Treasury withdrawal exceeds safe amount | Reconcile locked totals |
| `InsolventEscrowBalance` | Contract accounting integrity guard | Halt and investigate |
