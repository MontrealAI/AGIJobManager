# Configuration Reference

## Deployment inputs
Constructor arguments for `AGIJobManager`:
- `agiTokenAddress` (`<AGI_TOKEN_ADDRESS>`)
- `baseIpfs`
- `ensConfig`: `[<ENS_REGISTRY_ADDRESS>, <NAMEWRAPPER_ADDRESS>]`
- `rootNodes`: club, agent, alpha club, alpha agent
- `merkleRoots`: validator, agent

Resolved by `migrations/deploy-config.js` with env overrides.

## Tunable runtime parameters
- Validator thresholds: `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum`
- Timing: `completionReviewPeriod`, `disputeReviewPeriod`, `challengePeriodAfterApproval`
- Payout/risk controls: `validationRewardPercentage`, `maxJobPayout`, `jobDurationLimit`
- Validator bonds: `validatorBondBps/min/max`, `validatorSlashBps`
- Agent bonds: `agentBondBps/min/max` (`agentBond` is min)
- Identity/gating: roots, merkle roots, additional allowlists, blacklists

## Safe ranges and guardrails
- Percentages in bps must be `<= 10_000`.
- `validationRewardPercentage` must keep room for max AGIType payout (`maxAGITypePayout <= 100 - validationRewardPercentage`).
- Review/challenge periods must be `>0` and `<=365 days`.
- Threshold sums must not exceed `MAX_VALIDATORS_PER_JOB`.

## What lockIdentityConfiguration freezes
After `lockIdentityConfiguration()`:
- blocked: `updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `setEnsJobPages`, `updateRootNodes`
- still allowed: operational params, pause/unpause, settlement pause, moderators, allowlists, disputes

## Pause semantics
- `pause()` blocks functions with `whenNotPaused` (new activity).
- `settlementPaused=true` blocks settlement/ops functions guarded by `whenSettlementNotPaused`.
- `withdrawAGI` requires `paused==true` and `settlementPaused==false`.
