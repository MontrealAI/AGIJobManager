# AGIJobManager Operator Guide

This runbook is for owners/operators deploying and maintaining the `AGIJobManager` contract.

## Deployment parameters (constructor)

The constructor signature is:

```
constructor(
  address agiTokenAddress,
  string baseIpfs,
  address[2] ensConfig,
  bytes32[4] rootNodes,
  bytes32[2] merkleRoots
)
```

Parameter mapping:

1. `agiTokenAddress` — ERC‑20 token used for escrow and payouts.
2. `baseIpfs` — base URL used to prefix non‑full token URIs.
3. `ensConfig[0]` — ENS registry address.
4. `ensConfig[1]` — ENS NameWrapper address.
5. `rootNodes[0]` — `clubRootNode` (validator ENS root).
6. `rootNodes[1]` — `agentRootNode` (agent ENS root).
7. `rootNodes[2]` — `alphaClubRootNode` (secondary validator root).
8. `rootNodes[3]` — `alphaAgentRootNode` (secondary agent root).
9. `merkleRoots[0]` — `validatorMerkleRoot` (leaf = `keccak256(abi.encodePacked(address))`).
10. `merkleRoots[1]` — `agentMerkleRoot` (leaf = `keccak256(abi.encodePacked(address))`).

The ERC‑721 token is initialized as `AGIJobs` / `Job`.

## Safe default parameters

All parameters are upgradable by the owner. Defaults are set in the contract to conservative values; operators should verify each one before deployment:

- `requiredValidatorApprovals` / `requiredValidatorDisapprovals`: thresholds that control validation vs dispute. Must not exceed `MAX_VALIDATORS_PER_JOB` and the sum must not exceed `MAX_VALIDATORS_PER_JOB`.
- `voteQuorum`: minimum total validator votes required to avoid an automatic dispute when finalizing after the review period.
- `validationRewardPercentage`: percent of payout reserved for validators (only paid if at least one validator participates). Keep `max(AGIType.payoutPercentage) + validationRewardPercentage <= 100`.
- `additionalAgentPayoutPercentage`: stored configuration value; not used in payout calculations. Changes emit `AdditionalAgentPayoutPercentageUpdated`.
- `validatorBondBps`, `validatorBondMin`, `validatorBondMax`: bond size per validator vote; set to zero to disable bonds.
- `validatorSlashBps`: slash rate for incorrect validator votes.
- `agentBondBps`, `agentBond`, `agentBondMax`: agent bond size per job; set to zero to disable agent bonds.
- `challengePeriodAfterApproval`: delay after validator approval threshold before settlement.
- `maxJobPayout` / `jobDurationLimit`: upper bounds for new jobs.
- `completionReviewPeriod` / `disputeReviewPeriod`: timeouts for `finalizeJob` and `resolveStaleDispute`.
- `premiumReputationThreshold`: threshold for `canAccessPremiumFeature`.

## Operational procedures

### Pausing
- `pause`/`unpause` are owner‑only.
- When paused:
  - Most job actions are blocked (`createJob`, `applyForJob`, validation, disputes).
  - `requestJobCompletion` remains available for assigned agents so completion metadata can be submitted even during a brief pause.
  - `withdrawAGI` requires the contract to be paused; `resolveStaleDispute` is owner‑only after `disputeReviewPeriod` (pause optional, but often used for incident recovery).

### Managing allowlists
- **Merkle roots** are stored on‑chain and can be updated by the owner via `updateMerkleRoots`. Treat updates as governance events with audit logs.
- **Explicit allowlists** can be modified at runtime via:
  - `addAdditionalAgent` / `removeAdditionalAgent`
  - `addAdditionalValidator` / `removeAdditionalValidator`
- **Blacklists** can be enforced via:
  - `blacklistAgent`
  - `blacklistValidator`

### Managing ENS wiring and identity lock
- ENS wiring functions (`updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`) are only available while `lockIdentityConfig` is false **and** only before any jobs exist (`nextJobId == 0`) with zero escrow (`lockedEscrow == 0`). If either guard fails, the call reverts with `InvalidState` even if identity configuration is still unlocked.
- `lockIdentityConfiguration()` permanently disables those wiring updates by setting `lockIdentityConfig = true` and emits `IdentityConfigurationLocked`.
- `updateMerkleRoots` remains available after the lock and is the primary mechanism for allowlist rotation.

### Managing moderators
- `addModerator` / `removeModerator` are owner‑only.
- Moderators should be treated as trusted dispute arbiters.

### Managing AGI types
- `addAGIType(address nftAddress, uint256 payoutPercentage)` creates or updates an AGI type.
- The highest payout percentage among AGI types **plus** `validationRewardPercentage` must be ≤ 100.
- Agent payout percentage is snapshotted at assignment based on the highest AGI type the agent holds.

### Withdrawing ERC‑20
- `withdrawAGI(amount)` can only withdraw surplus balances; it fails if `balance < lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds` or `amount > withdrawableAGI()`.
- Withdrawals are only allowed while paused.

### Rotating the escrow token
- `updateAGITokenAddress` changes the ERC‑20 used for escrow, payouts, and reward pool contributions.
- The token can only be changed while identity configuration is unlocked **and** before any jobs exist (`nextJobId == 0`) with zero escrow (`lockedEscrow == 0`).
- Changing the token can break integrations and invalidate approvals. Ensure all users re‑approve the new token and carefully manage `lockedEscrow` vs balances before switching.
- **Production invariant**: treat the escrow token as immutable once jobs are funded.

## Monitoring checklist

- Track `JobCreated`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobDisputed`, `JobCompleted`, `DisputeResolvedWithCode`, and `JobExpired` for lifecycle visibility.
- Track `AGIWithdrawn` and `lockedEscrow`/`lockedAgentBonds`/`lockedValidatorBonds`/`lockedDisputeBonds` to ensure the contract remains solvent.
- Monitor `ReputationUpdated` to maintain off‑chain reputation views.

## Upgrade & recovery notes

- There is no upgradability pattern; any new version requires a new deployment.
- If a dispute becomes stale (no moderator action within `disputeReviewPeriod`), the owner can call `resolveStaleDispute` (pause optional).
