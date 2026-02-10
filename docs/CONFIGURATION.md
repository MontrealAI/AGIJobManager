# Configuration Guide

This guide is owner-focused and maps directly to current on-chain setters.

## 1) Identity / ENS configuration
Apply before jobs are live (or only when escrow/bonds are empty where required):
1. `updateAGITokenAddress(address)` (requires empty escrow/bonds).
2. `updateEnsRegistry(address)` (requires empty escrow/bonds).
3. `updateNameWrapper(address)` (requires empty escrow/bonds).
4. `updateRootNodes(club,agent,alphaClub,alphaAgent)` (requires empty escrow/bonds).
5. `updateMerkleRoots(validatorRoot,agentRoot)` (no empty-escrow guard).
6. `setEnsJobPages(address)` (identity-configurable; accepts zero to disable hooks).
7. Optional: `setUseEnsJobTokenURI(bool)`.
8. Optional one-way lock: `lockIdentityConfiguration()`.

## 2) Validator governance thresholds
- `setRequiredValidatorApprovals(uint256)`
- `setRequiredValidatorDisapprovals(uint256)`
- `setVoteQuorum(uint256)`

Safety constraints enforced on-chain:
- approvals/disapprovals individually and combined cannot exceed `MAX_VALIDATORS_PER_JOB`.
- quorum must be between `1` and `MAX_VALIDATORS_PER_JOB`.

## 3) Bond and slashing parameters
- Validator: `setValidatorBondParams(bps,min,max)`
- Agent: `setAgentBondParams(bps,min,max)` and legacy `setAgentBond(min)`
- Slashing: `setValidatorSlashBps(bps)`

Current defaults:
- Validator bond: `1500 bps`, min `10e18`, max `88888888e18`
- Agent bond: `500 bps`, min `1e18`, max `88888888e18`
- Validator slash: `2500 bps`

## 4) Time windows
- `setCompletionReviewPeriod(uint256)`
- `setDisputeReviewPeriod(uint256)`
- `setChallengePeriodAfterApproval(uint256)`

All three must be `> 0` and `<= 365 days`.

## 5) AGI types and payout policy
- `addAGIType(nftAddress,payoutPercentage)`
- `disableAGIType(nftAddress)`
- `setValidationRewardPercentage(uint256)`

Constraints:
- AGI type address must support ERC-721 interfaces.
- max AGI payout among enabled types plus `validationRewardPercentage` must be `<= 100`.
- max type count is `MAX_AGI_TYPES`.

## Safe configuration checklist
- [ ] Token/ENS/root wiring verified and (optionally) locked via `lockIdentityConfiguration()`.
- [ ] Thresholds/quorum fit expected validator turnout.
- [ ] `validationRewardPercentage + highest agent payout <= 100`.
- [ ] Bond min/max aligned with expected payout sizes.
- [ ] Review periods set to operationally support moderator response times.
- [ ] `setSettlementPaused(false)` and `unpause()` confirmed for go-live.

## Recommended defaults rationale (code-grounded)
- Keep non-zero `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, and `voteQuorum` to avoid easy completion/dispute triggers.
- Keep non-zero validator slash (`validatorSlashBps`) to maintain vote quality incentives.
- Retain bounded review periods (already hard-capped by contract) to ensure stale dispute escape via `resolveStaleDispute` remains viable.
