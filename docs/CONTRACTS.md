# Contracts Overview

## Contract map
- `AGIJobManager`: escrow, role checks, lifecycle, disputes, payout settlement, NFT minting.
- `ENSJobPages`: optional ENS sidecar called by AGIJobManager hooks.
- Utility libraries linked into AGIJobManager at deploy (`BondMath`, `ENSOwnership`, `ReputationMath`, `TransferUtils`, `UriUtils`).

## Role and permission matrix

| Role | Core permissions | Primary functions |
|---|---|---|
| Owner | Global admin/config, pause/unpause, settle stale disputes, treasury withdrawal (paused only), list management, identity lock | `pause`, `unpause`, `setSettlementPaused`, setters (`set*`, `update*`), `add/removeModerator`, `add/removeAdditional*`, `blacklist*`, `withdrawAGI`, `resolveStaleDispute`, `lockIdentityConfiguration` |
| Moderator | Active dispute resolution only | `resolveDispute`, `resolveDisputeWithCode` |
| Employer | Fund jobs, cancel pre-assignment, dispute, finalize/expire paths (public callable in some cases) | `createJob`, `cancelJob`, `disputeJob`, `finalizeJob` |
| Agent | Apply, post bond, request completion, dispute | `applyForJob`, `requestJobCompletion`, `disputeJob` |
| Validator | Vote approve/disapprove with bond | `validateJob`, `disapproveJob` |
| Public | Liveness/ops surfaces that are intentionally not role-restricted | `finalizeJob`, `expireJob`, `lockJobENS` (fuse burn still owner-only) |

## Critical configuration knobs

| Parameter | Default | Setter | Constraints/guards |
|---|---:|---|---|
| `requiredValidatorApprovals` | `3` | `setRequiredValidatorApprovals` | approvals/disapprovals each `<= MAX_VALIDATORS_PER_JOB` and sum `<= MAX_VALIDATORS_PER_JOB` |
| `requiredValidatorDisapprovals` | `3` | `setRequiredValidatorDisapprovals` | same threshold guard |
| `voteQuorum` | `3` | `setVoteQuorum` | `1..MAX_VALIDATORS_PER_JOB` |
| `validationRewardPercentage` | `8` | `setValidationRewardPercentage` | `1..100` and must not violate `max AGI type payout <= 100 - validationRewardPercentage` |
| `maxJobPayout` | `88888888e18` | `setMaxJobPayout` | used by `createJob` input validation |
| `jobDurationLimit` | `10000000` | `setJobDurationLimit` | used by `createJob` and bond math |
| `completionReviewPeriod` | `7 days` | `setCompletionReviewPeriod` | `>0` and `<= 365 days` |
| `disputeReviewPeriod` | `14 days` | `setDisputeReviewPeriod` | `>0` and `<= 365 days` |
| `challengePeriodAfterApproval` | `1 days` | `setChallengePeriodAfterApproval` | `>0` and `<= 365 days` |
| Validator bond params (`bps/min/max`) | `1500 / 10e18 / 88888888e18` | `setValidatorBondParams` | bounded parameter combinations, bps `<=10000` |
| Agent bond params (`bps/min/max`) | `500 / 1e18 / 88888888e18` | `setAgentBondParams` / `setAgentBond` | bps `<=10000`; zeroing allowed only as `(0,0,0)` in `setAgentBondParams` |
| `validatorSlashBps` | `2500` | `setValidatorSlashBps` | `<=10000` |
| Identity wiring (token/ENS/wrapper/root nodes/ENS hook) | constructor values | `updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `setEnsJobPages` | gated by `whenIdentityConfigurable`; some require empty escrow via `_requireEmptyEscrow()` |
| Merkle roots | constructor values | `updateMerkleRoots` | owner-only, no config lock |

