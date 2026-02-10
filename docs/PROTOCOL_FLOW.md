# Protocol Flow and Funds Accounting

## Escrow accounting model

The contract tracks four locked buckets:
- `lockedEscrow`: active job payout principal.
- `lockedAgentBonds`: active agent bonds.
- `lockedValidatorBonds`: active validator bonds.
- `lockedDisputeBonds`: active dispute bonds.

`withdrawableAGI()` is:

`agiToken.balanceOf(this) - (lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds)`

If balance is below locked total, `withdrawableAGI()` reverts with `InsolventEscrowBalance`.

## Bonds

- **Agent bond**: taken in `applyForJob`, sized by `agentBondBps/min/max` and payout, then locked until settlement.
- **Validator bond**: taken per vote in `validateJob`/`disapproveJob`, sized by `validatorBondBps/min/max` and capped at payout.
- **Dispute bond**: taken for manual disputes from employer/agent (`disputeJob`) when configured.

Settlement outcomes release bonds to different recipients depending on who wins and whether the vote/dispute path was used.

## Validator thresholds, quorum, and windows

- `requiredValidatorApprovals` and `requiredValidatorDisapprovals` gate automatic positive/negative signal transitions.
- `voteQuorum` defines the minimum vote participation for decisive finalize behavior.
- `completionReviewPeriod` controls voting/dispute timing after completion request.
- `challengePeriodAfterApproval` forces an additional delay after approval threshold before finalization.
- `disputeReviewPeriod` enables owner stale-dispute resolution after timeout.

## Dispute lifecycle

1. Manual dispute opened by assigned agent or employer (`disputeJob`) after completion request.
2. Dispute can also be auto-triggered by disapproval threshold.
3. While disputed, validator voting/finalization path is blocked.
4. Moderator resolves via `resolveDispute` or `resolveDisputeWithCode`.
5. Owner can resolve stale disputes via `resolveStaleDispute` once review timeout passes.

## Funds accounting table

| Stage | Payer | Receiver | Locked field impact |
|---|---|---|---|
| `createJob` | employer | contract escrow | `lockedEscrow += payout` |
| `applyForJob` | agent | contract bond pool | `lockedAgentBonds += agentBondAmount` |
| `validateJob` / `disapproveJob` | validator | contract bond pool | `lockedValidatorBonds += validatorBondAmount` |
| `disputeJob` (manual) | disputant | contract dispute pool | `lockedDisputeBonds += disputeBondAmount` |
| Agent-win settlement | contract | agent + correct validators (+ possible treasury remainder) | clears job-related locked buckets |
| Employer-win settlement | contract | employer + correct validators | clears job-related locked buckets |
| Expiry settlement | contract | employer refund (+ slashed agent bond to employer) | clears job-related locked buckets |

## Key events emitted

| Event | When emitted |
|---|---|
| `JobCreated` | Job escrow opened |
| `JobApplied` | Agent assignment recorded |
| `JobCompletionRequested` | Completion metadata submitted |
| `JobValidated` / `JobDisapproved` | Validator vote accepted |
| `JobDisputed` | Dispute opened |
| `DisputeResolved` / `DisputeResolvedWithCode` | Moderator resolves dispute |
| `JobCompleted` | Agent-win terminal settlement |
| `JobExpired` | Expiry terminal settlement |
| `AGIWithdrawn` | Owner withdraws treasury surplus while paused |
| `PlatformRevenueAccrued` | Agent-win remainder retained as treasury |
| `EnsHookAttempted` | Optional ENS hook call attempted |
| `JobENSPageCreated` / `JobENSPermissionsUpdated` / `JobENSLocked` | ENSJobPages side effects |
