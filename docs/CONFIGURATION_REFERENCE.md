# Configuration Reference

This page documents high-impact runtime settings in `AGIJobManager`.

## Critical lifecycle controls
- `pause()` / `unpause()` — global `whenNotPaused` guard.
- `setSettlementPaused(bool)` — blocks settlement-path functions guarded by `whenSettlementNotPaused`.
- `lockIdentityConfiguration()` — irreversible lock of identity/token wiring.

## Validator settings
- `setRequiredValidatorApprovals(uint256)`
- `setRequiredValidatorDisapprovals(uint256)`
- `setVoteQuorum(uint256)`
- `setValidationRewardPercentage(uint256)`
- `setValidatorBondParams(uint256 bps, uint256 min, uint256 max)`
- `setValidatorSlashBps(uint256 bps)`
- `setChallengePeriodAfterApproval(uint256 period)`

Safe-range guidance:
- Ensure approvals/disapprovals each `<= MAX_VALIDATORS_PER_JOB` and combined `<= MAX_VALIDATORS_PER_JOB`.
- Keep `validationRewardPercentage + max(agent payout %) <= 100`.
- Keep slash and bond bps in `[0, 10000]`.

## Agent settings
- `setAgentBondParams(uint256 bps, uint256 min, uint256 max)`
- `setAgentBond(uint256 bond)` (legacy min setter)
- `addAGIType(address nftAddress, uint256 payoutPercentage)` / `disableAGIType(address)`

Safe-range guidance:
- `payoutPercentage` in `(0,100]` for enabled types.
- Number of AGI types bounded by `MAX_AGI_TYPES`.

## Job constraints
- `setMaxJobPayout(uint256)`
- `setJobDurationLimit(uint256)`
- `setCompletionReviewPeriod(uint256)`
- `setDisputeReviewPeriod(uint256)`

Safe-range guidance:
- Review periods must be `>0` and `<= 365 days`.
- Keep payout and duration limits aligned with token decimal assumptions and ops risk tolerances.

## Identity and access wiring
- `updateAGITokenAddress(address)`
- `updateEnsRegistry(address)`
- `updateNameWrapper(address)`
- `updateRootNodes(...)`
- `updateMerkleRoots(bytes32,bytes32)`
- `setEnsJobPages(address)`
- `setUseEnsJobTokenURI(bool)`
- `setBaseIpfsUrl(string)`

### What cannot be changed after identity lock
After `lockIdentityConfiguration()`:
- AGI token address
- ENS registry
- NameWrapper
- root nodes
- ENSJobPages endpoint

Operational/config setters (pause, bonds, periods, thresholds, blacklist/allowlist) remain owner-controlled.

## Treasury and solvency
- `withdrawableAGI()` computes `balance - lockedTotal` and reverts on insolvency.
- `withdrawAGI(amount)` requires:
  - owner
  - `paused == true`
  - `settlementPaused == false`
  - `amount <= withdrawableAGI()`

## Deprecated knobs
- `setAdditionalAgentPayoutPercentage(uint256)` is intentionally deprecated and reverts.
