# Contract behavior summary (AGIJobManager.sol)

This document summarizes **current on‑chain behavior**. It is a reading guide, not a replacement for the contract.

## Roles and permissions

- **Owner**: can pause/unpause, tune parameters, manage allowlists/blacklists, add/remove moderators, and lock identity wiring (ENS/namewrapper/root nodes). Uses `onlyOwner` functions throughout.
- **Moderator**: resolves disputes via `resolveDispute` / `resolveDisputeWithCode`.
- **Employer**: creates jobs, can cancel pre‑assignment, can initiate disputes, and receives the completion NFT.
- **Agent**: applies for a job, requests completion, receives payout and reputation on agent wins.
- **Validator**: approves/disapproves completion, posts a bond per vote, and earns/slashes based on outcome.

## Job lifecycle (implemented state flow)

1. **Create job**: employer calls `createJob`, funding escrow and publishing a `jobSpecURI`.
2. **Assign agent**: an eligible agent calls `applyForJob`, posting an agent bond and snapshotting payout percentage.
3. **Request completion**: assigned agent calls `requestJobCompletion`, setting `jobCompletionURI`.
4. **Validator vote**: validators call `validateJob` or `disapproveJob` during the review window.
5. **Finalize**:
   - If approvals meet threshold and the challenge period elapses, the job completes **only if approvals still exceed disapprovals**.
   - After the review period ends, the job finalizes using the end‑of‑review rules below.
6. **Dispute**: disapprovals hitting threshold, or manual disputes, move the job into a dispute state.
7. **Dispute resolution**: moderators or owner resolve disputes, leading to completion or employer refund.
8. **Completion NFT**: minted to the employer; `tokenURI` uses `jobCompletionURI`, but may be prefixed with `baseIpfsUrl` if the completion URI has no scheme.

## Time windows and thresholds

- `job.duration`: per‑job duration set at creation.
- `completionReviewPeriod`: validator review window after completion is requested.
- `disputeReviewPeriod`: dispute cooling period before owner can resolve stale disputes.
- `challengePeriodAfterApproval`: waiting period after approvals reach threshold.
- `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, and `voteQuorum`: thresholds for settlement and dispute transitions.

## Validation and dispute entry rules

- `validateJob` / `disapproveJob` require `completionRequested == true` and must occur **before** the `completionReviewPeriod` elapses.
- Disapprovals reaching `requiredValidatorDisapprovals` mark the job as **disputed**.
- `disputeJob` is available to the employer or assigned agent **only after** completion is requested and **before** the review window ends.

## Finalization behavior (explicit rules)

### 1) Approval threshold + challenge period
- If approvals reach the threshold, `validatorApproved` is set with a timestamp.
- Finalization can happen only after the `challengePeriodAfterApproval` passes.
- If approvals are still **greater** than disapprovals at that time, the job completes in favor of the agent.

### 2) End of review period behavior
After `completionReviewPeriod` has elapsed:
- **0 total votes** → job completes in favor of the agent **without reputation gain** (no‑vote liveness rule).
- **Under quorum** or **exact tie** → job moves to **dispute**.
- **More approvals** → job completes in favor of the agent.
- **More disapprovals** → employer is refunded.

### 3) Dispute outcomes
- **Moderator decision** can finalize the job in favor of agent or employer.
- **Owner stale‑dispute resolution** is available after `disputeReviewPeriod`.

## Pause behavior
- `pause()` blocks **new activity** guarded by `whenNotPaused`, including create/apply/validate/disapprove/dispute.
- `requestJobCompletion`, `finalizeJob`, `cancelJob`, and `expireJob` are **not** pause‑gated and remain available.

## Completion metadata requirements
- `requestJobCompletion` requires a non‑empty URI and stores it on‑chain.
- `finalizeJob` and dispute resolutions that award the agent rely on that stored completion URI.
- `tokenURI` is set to `jobCompletionURI`, prefixed with `baseIpfsUrl` if the URI has no scheme.

## Identity and eligibility gating
Eligibility for agents and validators is enforced by:
- Merkle allowlists.
- ENS namespace ownership checks.
- NameWrapper ownership checks.
- Resolver address checks.
- Explicit allowlists and blacklists.

## Settlement notes
- Completion mints an ERC‑721 receipt to the employer with the completion metadata URI.
- Validator rewards and agent bonds are settled as part of completion/refund.
- The contract enforces that **completion metadata must exist** for an agent win.
