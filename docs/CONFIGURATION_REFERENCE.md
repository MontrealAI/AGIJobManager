# Configuration Reference

## Purpose
Single reference for mutable parameters, defaults, and operational constraints.

## Audience
Owner operators, reviewers, and incident responders.

## Preconditions / assumptions
- Values below reflect current contract defaults in `AGIJobManager.sol`.
- `lockIdentityConfiguration()` freezes token/ENS/root wiring setters, but `updateMerkleRoots` remains mutable by owner.

## Runtime parameters
| Parameter | Default | Setter | Notes / safe range guidance |
|---|---:|---|---|
| `requiredValidatorApprovals` | 3 | `setRequiredValidatorApprovals` | Keep `<= MAX_VALIDATORS_PER_JOB` and coordinated with quorum. |
| `requiredValidatorDisapprovals` | 3 | `setRequiredValidatorDisapprovals` | Keep `<= MAX_VALIDATORS_PER_JOB`. |
| `voteQuorum` | 3 | `setVoteQuorum` | Enforced positive; align with thresholds. |
| `validationRewardPercentage` | 8 | `setValidationRewardPercentage` | Must satisfy `(max AGIType payout + validationRewardPercentage) <= 100`. |
| `maxJobPayout` | 88,888,888e18 | `setMaxJobPayout` | Must be `>0`; cap should match treasury risk appetite. |
| `jobDurationLimit` | 10,000,000 | `setJobDurationLimit` | Must be `>0`. |
| `completionReviewPeriod` | 7 days | `setCompletionReviewPeriod` | `1..365 days`. |
| `disputeReviewPeriod` | 14 days | `setDisputeReviewPeriod` | `1..365 days`. |
| `validatorBondBps/min/max` | 1500 / 10e18 / 88,888,888e18 | `setValidatorBondParams` | Percentage in bps with clamps; bond capped at payout. |
| `validatorSlashBps` | 8000 | `setValidatorSlashBps` | Upper bounded at 10000 bps. |
| `challengePeriodAfterApproval` | 1 day | `setChallengePeriodAfterApproval` | `<= 365 days`. |
| `agentBond` (min floor) | 1e18 | `setAgentBond` | Must not exceed `agentBondMax` or payout cap paths become restrictive. |
| `agentBondBps/min/max` | 500 / 1e18 / 88,888,888e18 | `setAgentBondParams` | Duration-adjusted by `BondMath.computeAgentBond`. |
| `premiumReputationThreshold` | 10000 | `setPremiumReputationThreshold` | Product policy threshold; no hard upper bound in setter. |
| `baseIpfsUrl` | constructor-supplied | `setBaseIpfsUrl` | Used by URI composition when no scheme present. |

## Identity and eligibility wiring
| Variable | Setter | Lock status after `lockIdentityConfiguration()` |
|---|---|---|
| `agiToken` | `updateAGITokenAddress` | **Immutable after lock** |
| `ens` | `updateEnsRegistry` | **Immutable after lock** |
| `nameWrapper` | `updateNameWrapper` | **Immutable after lock** |
| `ensJobPages` | `setEnsJobPages` | **Immutable after lock** |
| ENS root nodes | `updateRootNodes` | **Immutable after lock** |
| Merkle roots | `updateMerkleRoots` | **Mutable after lock (owner-only)** |
| `useEnsJobTokenURI` | `setUseEnsJobTokenURI` | Mutable after lock |

## Lists and role toggles
- `addModerator` / `removeModerator`
- `addAdditionalValidator` / `removeAdditionalValidator`
- `addAdditionalAgent` / `removeAdditionalAgent`
- `blacklistAgent` / `blacklistValidator`
- `addAGIType` / `disableAGIType` (bounded by `MAX_AGI_TYPES`)

## Change-management checklist
1. Announce intent and maintenance window.
2. Optionally `pause()` before sensitive changes.
3. Apply one config family at a time.
4. Run:
   - `node scripts/verify-config.js --network <net> --address <addr>`
   - `truffle exec scripts/ops/validate-params.js --network <net> --address <addr>`
5. Unpause only after smoke tests pass.

## Gotchas / failure modes
- `setAdditionalAgentPayoutPercentage` is deprecated and always reverts.
- Bad threshold combinations revert via `InvalidValidatorThresholds`.
- Identity-lock mistakes require redeploy; there is no upgrade path.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../scripts/verify-config.js`](../scripts/verify-config.js)
- [`../scripts/ops/validate-params.js`](../scripts/ops/validate-params.js)
