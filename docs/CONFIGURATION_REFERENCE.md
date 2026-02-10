# Configuration Reference

## Purpose
Canonical parameter and change-management reference for AGIJobManager deployments.

## Audience
Owners/operators and auditors.

## Preconditions
- Deployment completed and address known.
- Change control process in place.

## Core Parameters
| Parameter | Default | Setter | Notes / Safe range |
|---|---:|---|---|
| `requiredValidatorApprovals` | `3` | `setRequiredValidatorApprovals` | Must satisfy approvals+disapprovals <= `MAX_VALIDATORS_PER_JOB` |
| `requiredValidatorDisapprovals` | `3` | `setRequiredValidatorDisapprovals` | Same threshold invariant |
| `voteQuorum` | `3` | `setVoteQuorum` | 1..`MAX_VALIDATORS_PER_JOB` |
| `validationRewardPercentage` | `8` | `setValidationRewardPercentage` | 1..100 and must leave room for max AGIType payout |
| `maxJobPayout` | `88888888e18` | `setMaxJobPayout` | Hard upper bound for createJob |
| `jobDurationLimit` | `10000000` | `setJobDurationLimit` | Hard upper bound for createJob duration |
| `completionReviewPeriod` | `7 days` | `setCompletionReviewPeriod` | >0 and <=365 days |
| `disputeReviewPeriod` | `14 days` | `setDisputeReviewPeriod` | >0 and <=365 days |
| `validatorBondBps/min/max` | `1500 / 10e18 / 88888888e18` | `setValidatorBondParams` | supports full disable only when bps=min=max=0 constraints satisfied |
| `validatorSlashBps` | `8000` | `setValidatorSlashBps` | 0..10000 |
| `challengePeriodAfterApproval` | `1 day` | `setChallengePeriodAfterApproval` | >0 and <=365 days |
| `agentBondBps/min/max` | `500 / 1e18 / 88888888e18` | `setAgentBondParams` | can set all to 0 to disable |
| `premiumReputationThreshold` | `10000` | `setPremiumReputationThreshold` | app policy knob |

## Identity/Gating Configuration
| Item | Mutable before lock | Mutable after lock |
|---|---|---|
| AGI token address | Yes | No |
| ENS registry | Yes | No |
| NameWrapper | Yes | No |
| ENS job pages address | Yes | No |
| Root nodes | Yes | No |
| Merkle roots | Yes | Yes |
| Additional allowlists and blacklists | Yes | Yes |

## Immutable-After-Lock Behavior
`lockIdentityConfiguration()` permanently disables identity wiring setters guarded by `whenIdentityConfigurable`.

## Change Management Guidance
- Announce parameter changes ahead of time.
- For sensitive changes (bonds/thresholds/review windows), pause new activity first.
- Run `truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJOBMANAGER_ADDRESS>` after every change window.

## Gotchas
- `setAdditionalAgentPayoutPercentage` is deprecated and unusable.
- High `validationRewardPercentage` can block AGIType updates due to sum constraint.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../scripts/ops/validate-params.js`](../scripts/ops/validate-params.js)
