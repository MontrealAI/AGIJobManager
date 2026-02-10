# Protocol Flow and Economic Accounting

## Escrow accounting model

`withdrawableAGI()` defines treasury-only withdrawability:

- `lockedEscrow`: sum of unsettled job payouts.
- `lockedAgentBonds`: active agent performance bonds.
- `lockedValidatorBonds`: active validator vote bonds.
- `lockedDisputeBonds`: active dispute bonds.
- `withdrawableAGI = agiToken.balanceOf(this) - (all locked*)` (reverts if insolvent).

Owner withdrawals (`withdrawAGI`) are additionally restricted to **paused** mode and blocked if `settlementPaused` is true.

## Bonds and settlement logic

### Agent bond
- Computed on `applyForJob` with `BondMath.computeAgentBond(payout, duration, agentBondBps, agentBond, agentBondMax, jobDurationLimit)`.
- Added to `lockedAgentBonds` at assignment.
- Returned on agent-win paths (`_completeJob`).
- Slashed on employer-win/expiry; routing:
  - to employer on expiry or non-threshold employer wins,
  - into validator reward pool when disapproval threshold triggered employer win.

### Validator bond
- Computed per job on first vote using `validatorBondBps/min/max`, then reused for all voters on that job.
- Added to `lockedValidatorBonds` for each vote.
- On settlement: validators on correct side receive bond + reward share; incorrect side receives bond minus slash (`validatorSlashBps`).

### Dispute bond
- Charged in `disputeJob` to the disputant (agent or employer):
  - `payout * 50 bps` bounded by `1e18` min, `200e18` max, and `<= payout`.
- Added to `lockedDisputeBonds`.
- Always paid to terminal winner side: assigned agent on agent-win, employer on employer-win.

## Validator voting, thresholds, and windows

- Voting requires completion requested, non-expired windows, authorization, and no prior vote.
- `requiredValidatorApprovals`: early-approval latch (`validatorApproved=true`) and challenge-timer start.
- `requiredValidatorDisapprovals`: automatic dispute transition.
- `voteQuorum`: used in slow-path finalize decision after review window.

`finalizeJob` logic:
1. If approval latch set and challenge period elapsed, approvals>disapprovals => agent-win completion.
2. Else after `completionReviewPeriod`:
   - no votes => agent-win completion (liveness path, no validator reputation gain),
   - under quorum or tie => disputed,
   - approvals>disapprovals => agent-win completion,
   - disapprovals>approvals => employer refund path.

## Dispute lifecycle

- Entered by `disputeJob` (manual) or disapproval threshold.
- While disputed, validator settlement path is frozen.
- Exits:
  - `resolveDisputeWithCode(jobId, 1, reason)` => agent win.
  - `resolveDisputeWithCode(jobId, 2, reason)` => employer win.
  - `resolveDisputeWithCode(jobId, 0, reason)` => NO_ACTION, dispute stays active.
  - `resolveStaleDispute(jobId, employerWins)` by owner after `disputeReviewPeriod`.

## Funds accounting matrix

| Terminal outcome | Escrow payout | Agent bond | Validator bonds | Dispute bond | NFT minted |
|---|---|---|---|---|---|
| Agent win (`_completeJob`) | Agent gets `%` by AGI type, validator budget distributed/refunded; remainder retained as platform revenue | Returned to agent | Settled with slashing/rewards to validators; residual dust to winner side | Paid to assigned agent (winner side payout rule) | Yes |
| Employer win (`_refundEmployer`) | Employer refunded payout minus validator reward budget when validators exist | Slashed (to employer or validator pool depending on threshold condition) | Settled with slashing/rewards favoring disapprovers | Paid to employer (winner side payout rule) | No |
| Expiry (`expireJob`) | Full payout returned to employer | Slashed to employer | none (no completion voting) | none | No |
| Cancel/Delist before assignment | Full payout returned to employer | none | none | none | No |

## Key events emitted

| Event | When emitted |
|---|---|
| `JobCreated` | Employer creates and funds job |
| `JobApplied` | Agent successfully assigned |
| `JobCompletionRequested` | Assigned agent submits completion URI |
| `JobValidated` / `JobDisapproved` | Validator vote accepted |
| `JobDisputed` | Manual dispute or disapproval-threshold escalation |
| `DisputeResolved` / `DisputeResolvedWithCode` | Moderator resolves dispute |
| `JobCompleted` | Agent-win completion path settles |
| `JobExpired` | Assignment expired without completion request |
| `JobCancelled` | Job cancelled/delisted pre-assignment |
| `NFTIssued` | Completion NFT minted to employer |
| `PlatformRevenueAccrued` | Agent-win retained remainder recorded |
| `AGIWithdrawn` | Owner withdraws treasury surplus while paused |
| `EnsHookAttempted` | AGIJobManager best-effort call to ENSJobPages |
