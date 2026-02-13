# Monitoring

## Events catalog

| Event | When emitted | How to monitor | Suggested alert |
| --- | --- | --- | --- |
| `JobCreated` | New funded escrow | job counter and payout aggregate | sudden spike detection |
| `JobApplied` | Agent assigned | per-job assignment lag | stale jobs without completion requests |
| `JobCompletionRequested` | Agent submits completion | SLA timers for validator window | missing validator participation |
| `JobValidated` / `JobDisapproved` | Validator vote | quorum progression tracking | conflicting vote wave |
| `JobDisputed` / `DisputeResolvedWithCode` | Dispute lifecycle | moderator queue age | unresolved disputes > review period |
| `JobCompleted` / `JobCancelled` / `JobExpired` | terminal settlement | financial reconciliation | settlement anomalies |
| `AGIWithdrawn` | treasury movement | treasury policy checks | withdrawal outside maintenance window |

## State sanity checks

- `withdrawableAGI()` remains non-negative and aligned with treasury policy.
- Locked accounting totals trend with active jobs and bonds.
- Pause/settlement pause flags match incident state.
