# Protocol Flow and Funds Accounting

## 1) Escrow accounting model

`AGIJobManager` tracks locked liabilities using four counters:
- `lockedEscrow`: funded job payouts not yet released.
- `lockedAgentBonds`: agent performance bonds for unsettled jobs.
- `lockedValidatorBonds`: validator vote bonds.
- `lockedDisputeBonds`: dispute-initiator bonds.

Owner treasury withdrawals are constrained by:

`withdrawableAGI = tokenBalance - (lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds)`

`withdrawAGI` only executes when **both** `whenPaused` and `whenSettlementNotPaused` are true.

## 2) Bond lifecycle

### Agent bond
- Computed at `applyForJob` via `BondMath.computeAgentBond` using payout, duration, and `agentBondBps/agentBond/agentBondMax`.
- Locked into `lockedAgentBonds` at apply time.
- On terminal state:
  - agent-win: refunded to agent.
  - employer-win/refund/expiry: slashed to employer **or** pooled for validators when disapproval threshold path is used.

### Validator bond
- Computed once per job (`validatorBondAmount` cached) via `BondMath.computeValidatorBond`.
- Every vote posts the same bond amount and increments `lockedValidatorBonds`.
- Settlement:
  - incorrect validators are slashed by `validatorSlashBps`.
  - correct validators share escrow validator budget + slashed pool + optional extra pool.

### Dispute bond
- `disputeJob` charges `DISPUTE_BOND_BPS` (50 bps), clamped to `DISPUTE_BOND_MIN` (1e18), `DISPUTE_BOND_MAX` (200e18), and payout cap.
- Locked into `lockedDisputeBonds`.
- Refunded to winner side on resolution (`agent` on agent-win, `employer` on employer-win).

## 3) Voting, thresholds, quorum, and challenge windows

### Vote admission
A validator vote requires:
- authorized validator identity (allowlist, Merkle proof, or ENS ownership path),
- not blacklisted,
- completion already requested,
- review window still open,
- no prior vote from the same validator,
- per-job validator cap not exceeded.

### Fast approval track
If approvals reach `requiredValidatorApprovals`, `validatorApproved=true` and timestamp is captured. Finalization can then proceed after `challengePeriodAfterApproval`, if approvals still exceed disapprovals.

### Slow path (`finalizeJob`)
After `completionReviewPeriod`:
- `0` votes => deterministic agent win (liveness path, no reputation eligibility).
- under quorum or tie => forced dispute.
- approvals > disapprovals => agent win.
- disapprovals > approvals => employer refund path.

## 4) Dispute lifecycle

### Manual disputes
- `disputeJob` by assigned agent or employer during completion review window.
- moderators resolve via `resolveDisputeWithCode`:
  - `0` = no action (dispute stays active)
  - `1` = agent win
  - `2` = employer win

### Stale dispute recovery
- `resolveStaleDispute` is owner-only.
- requires dispute active and `disputeReviewPeriod` elapsed.
- owner picks terminal outcome (`employerWins` bool).

## 5) Funds accounting by terminal outcome

| Terminal outcome | Escrow payout | Agent bond | Validator bond settlement | Dispute bond | Who receives principal outcome |
|---|---|---|---|---|---|
| Agent win | agent gets agent payout %, validator budget reserved | refunded to agent | correct validators rewarded; incorrect slashed | to agent side | agent + validators; possible retained remainder in treasury |
| Employer win (via finalize or dispute) | employer refunded (minus validator reward budget when validators exist) | slashed to employer or pooled to validators (threshold path) | correct-side (disapprovers) rewarded | to employer side | employer + validators |
| Expired | employer refunded full payout | slashed to employer | none (no completion voting path) | none | employer |
| Cancelled/unassigned delisted | employer refunded full payout | n/a | n/a | n/a | employer |

## 6) Events emitted (key protocol + ENS hooks)

| Event | Trigger |
|---|---|
| `JobCreated` | New job escrowed by employer. |
| `JobApplied` | Agent assigned and bond posted. |
| `JobCompletionRequested` | Assigned agent requests completion. |
| `JobValidated` / `JobDisapproved` | Validator vote recorded. |
| `JobDisputed` | Disapproval threshold/manual dispute/quorum tie-underflow path. |
| `JobCompleted` | Agent-win settlement executed. |
| `DisputeResolved` + `DisputeResolvedWithCode` | Moderator typed dispute resolution. |
| `JobExpired` / `JobCancelled` | Terminal non-completion exits. |
| `NFTIssued` | Completion NFT minted to employer. |
| `PlatformRevenueAccrued` | Agent-win retained remainder recorded. |
| `EnsHookAttempted` | Any ENS hook call attempt (`hook` 1..6), success flag included. |
