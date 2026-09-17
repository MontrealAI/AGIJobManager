# Contract behavior summary — v0.9.0

This document summarizes the current contract implementation. A software release does not itself deploy a live contract. See the [user guide](USERS.md), [payout specification](USDC_PAYOUT_SPLIT.md), and [configuration reference](CONFIGURATION.md).

## Roles and permissions

- **Owner**: can pause/unpause, tune parameters, manage allowlists/blacklists, add/remove moderators, and lock identity wiring (ENS/namewrapper/root nodes). Uses `onlyOwner` functions throughout.
- **Moderator**: resolves disputes via `resolveDisputeWithCode` with numeric code 0, 1, or 2.
- **Employer**: creates jobs, can cancel pre‑assignment, can initiate disputes, and receives the completion NFT.
- **Agent**: applies for a job, requests completion, receives payout and reputation on agent wins.
- **Validator**: approves/disapproves completion, posts a bond per vote, and earns/slashes based on outcome.

## Job lifecycle (implemented state flow)

1. **Create job**: employer calls `createJob`, funding native USDC escrow, recording the validator reward percentage for that job, and publishing a `jobSpecURI`.
2. **Assign agent**: the first eligible successful applicant is assigned by `applyForJob`, posting its USDC performance bond. The bond is fixed at assignment; NFT credentials do not set payout percentages.
3. **Request completion**: assigned agent calls `requestJobCompletion`, setting `jobCompletionURI`.
4. **Validator vote**: validators call `validateJob` or `disapproveJob` during the review window.
5. **Finalize**:
   - Anyone must submit a separate `finalizeJob` transaction; votes never automatically pay. When the approval threshold is latched, its challenge window must strictly elapse, even if the review window ends first. An undisputed approval majority can then complete.
   - After the review period ends, the job finalizes using the end‑of‑review rules below.
6. **Dispute**: disapprovals hitting threshold, or manual disputes, move the job into a dispute state.
7. **Dispute resolution**: moderators or owner resolve disputes, leading to completion or employer refund.
8. **Completion NFT**: successful work mints a receipt to the employer using the configured ENS URI or completion-URI/base fallback. Employer-win refunds do not mint it.

## Time windows and thresholds

- `job.duration`: per-job duration set at creation; its clock begins at assignment.
- `completionReviewPeriod`: validator review window after completion is requested.
- `disputeReviewPeriod`: dispute cooling period before owner can resolve stale disputes.
- `challengePeriodAfterApproval`: waiting period after approvals reach threshold.
- `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, and `voteQuorum`: thresholds for settlement and dispute transitions.

## Validation and dispute entry rules

- `validateJob` / `disapproveJob` require `completionRequested == true` and are accepted through `completionRequestedAt + completionReviewPeriod` while the job remains unsettled and undisputed.
- Disapprovals reaching `requiredValidatorDisapprovals` mark the job as **disputed**.
- `disputeJob` is available to the employer or assigned agent **only after** completion is requested, through its review deadline, while unsettled and undisputed. The caller must approve and fund the USDC dispute bond.

## Finalization behavior (explicit rules)

### 1) Approval threshold + challenge period
- If approvals reach the threshold, `validatorApproved` is set with a timestamp.
- Finalization can happen only after the `challengePeriodAfterApproval` passes.
- If approvals are still **greater** than disapprovals at that time, the job completes in favor of the agent.

### 2) End of review period behavior
Strictly after the completion review deadline, subject to any latched approval challenge and no active dispute:
- **0 total votes** → job completes in favor of the agent **without reputation gain** (no‑vote liveness rule).
- **Nonzero votes under quorum** or an **exact tie** → job moves to **dispute**.
- **Quorum reached with more approvals** → job completes in favor of the agent.
- **Quorum reached with more disapprovals** → employer receives the adjusted reward/bond refund.

### 3) Dispute outcomes
- **Moderator decision** can finalize the job in favor of agent or employer.
- **Owner stale-dispute resolution** is available strictly after `disputedAt + disputeReviewPeriod`, with settlement enabled; intake need not be paused.

## Pause behavior
- `pause()` / `pauseIntake()` block job creation and application. Existing completion requests, votes, disputes, and settlement remain available under their other guards when settlement is enabled.
- `setSettlementPaused(true)` blocks all settlement-gated actions, including creation/application, completion, voting, disputes, finalization, cancellation, expiry, and USDC withdrawals.
- `pauseAll()` pauses both lanes. Fresh deployments start with intake paused until commissioning.

## Completion metadata requirements
- `requestJobCompletion` requires a non‑empty URI and stores it on‑chain.
- `finalizeJob` and dispute resolutions that award the agent rely on that stored completion URI.
- A bounded optional ENS lookup can supply the receipt URI. It falls back to `jobCompletionURI`, applying `baseIpfsUrl` when needed.

## Identity and eligibility gating
Eligibility for agents and validators is enforced by:
- Merkle allowlists.
- ENS namespace ownership checks.
- NameWrapper ownership or qualifying approval checks.
- Resolver address checks.
- Explicit allowlists and blacklists.

Agents also need a registered, eligible AGI-type NFT credential in addition to an identity route. Credentials establish eligibility rather than a USDC bonus.

## Settlement notes
- Completion mints an ERC‑721 receipt to the employer with the completion metadata URI.
- Validator rewards and agent bonds are settled as part of completion/refund.
- The contract enforces that **completion metadata must exist** for an agent win.

Successful settlement pays validators first, then 30% and 10% of the original cost to the configured wallets, then all remaining USDC to the agent. The validator budget is fixed at posting (8% default, 1–60% for new jobs). No-vote completion charges no validator budget. Refunds, cancellation and expiry pay no 30%/10% shares; bonds are separate. ETH is required for gas.
