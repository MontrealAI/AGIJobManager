# Configuration Guide

All settings below are from owner-settable functions in `contracts/AGIJobManager.sol` and `contracts/ens/ENSJobPages.sol`.

## 1) Identity / ENS configuration

Set before production traffic; many are frozen by `lockIdentityConfiguration()`.

1. `updateAGITokenAddress(address)` (requires empty escrow; identity lock must be false)
2. `updateEnsRegistry(address)` (requires empty escrow; identity lock must be false)
3. `updateNameWrapper(address)` (requires empty escrow; identity lock must be false)
4. `setEnsJobPages(address)` (identity lock must be false)
5. `updateRootNodes(clubRoot, agentRoot, alphaClubRoot, alphaAgentRoot)` (requires empty escrow; identity lock must be false)
6. `updateMerkleRoots(validatorMerkleRoot, agentMerkleRoot)`

### ENSJobPages-side setup

- `setENSRegistry`, `setNameWrapper`, `setPublicResolver`, `setJobsRoot`, `setJobManager`.

## 2) Validator governance thresholds

- `setRequiredValidatorApprovals(uint256)`
- `setRequiredValidatorDisapprovals(uint256)`
- `setVoteQuorum(uint256)`
- `setValidationRewardPercentage(uint256)`

Constraints:
- Threshold sums are bounded by `MAX_VALIDATORS_PER_JOB`.
- Quorum must be in `1..MAX_VALIDATORS_PER_JOB`.
- Validation reward must be `1..100` and still allow AGI type payout caps.

## 3) Bond parameters

- Validator bond: `setValidatorBondParams(bps,min,max)`.
- Agent bond: `setAgentBondParams(bps,min,max)` or legacy min-only setter `setAgentBond(uint256)`.
- Validator slash: `setValidatorSlashBps(uint256)`.

## 4) Time windows

- `setCompletionReviewPeriod(uint256)`
- `setDisputeReviewPeriod(uint256)`
- `setChallengePeriodAfterApproval(uint256)`

All must be `> 0` and `<= 365 days`.

## 5) AGI types / payout policy

- `addAGIType(address nftAddress, uint256 payoutPercentage)`
- `disableAGIType(address nftAddress)`

Constraints:
- ERC-721 support is checked.
- max entries capped by `MAX_AGI_TYPES` (32).
- Maximum active AGI payout percentage must satisfy: `maxAGITypePct + validationRewardPercentage <= 100`.

## 6) Safety checklist (pre-unpause)

- [ ] `agiToken`, `ens`, `nameWrapper` are correct.
- [ ] Root nodes and Merkle roots point to intended policy sets.
- [ ] `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum` are coherent.
- [ ] Bond params and slash params are non-zero (unless intentional disable).
- [ ] Review/challenge/dispute windows are operationally realistic.
- [ ] AGI type payout cap does not collide with validator reward percentage.
- [ ] ENS hook target (`ensJobPages`) is set and has code if used.
- [ ] `pause`/`settlementPaused` state matches launch plan.
- [ ] Decide whether to call `lockIdentityConfiguration` now or after proving deployment.

## Recommended starting profile (code-compatible)

A conservative starting point is to keep defaults and only tune after observing production behavior:
- approvals/disapprovals/quorum: `3 / 3 / 3`
- `validationRewardPercentage`: `8`
- review windows: `7d completion`, `14d dispute`, `1d challenge`
- validator bonds/slash: `1500 bps`, `10e18..88888888e18`, slash `8000 bps`

These are the constructor defaults in current code and are accepted by all guards.
