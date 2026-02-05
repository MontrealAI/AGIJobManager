# AGIJobManager Operator Guide

This runbook is for owners/operators deploying and maintaining the `AGIJobManager` contract.

## Deployment parameters (constructor)

The constructor requires:

1. `address _agiTokenAddress` — ERC‑20 token used for escrow and payouts.
2. `string _baseIpfsUrl` — base URL used to prefix non‑full token URIs.
3. `address _ensAddress` — ENS registry address.
4. `address _nameWrapperAddress` — ENS NameWrapper address.
5. `bytes32 _clubRootNode` — ENS root node for validator subdomains.
6. `bytes32 _agentRootNode` — ENS root node for agent subdomains.
7. `bytes32 _validatorMerkleRoot` — Merkle root for validator allowlist (leaf = `keccak256(abi.encodePacked(address))`).
8. `bytes32 _agentMerkleRoot` — Merkle root for agent allowlist (leaf = `keccak256(abi.encodePacked(address))`).

The ERC‑721 token is initialized as `AGIJobs` / `Job`.

## Safe default parameters

All parameters are upgradable by the owner. Defaults are set in the contract to conservative values; operators should verify each one before deployment:

- `requiredValidatorApprovals` / `requiredValidatorDisapprovals`: thresholds that control validation vs dispute. Must not exceed `MAX_VALIDATORS_PER_JOB` and the sum must not exceed `MAX_VALIDATORS_PER_JOB`.
- `validationRewardPercentage`: percent of payout reserved for validators (only paid if at least one validator participates). Keep `max(AGIType.payoutPercentage) + validationRewardPercentage <= 100`.
- `additionalAgentPayoutPercentage`: stored configuration value; not currently used in payout calculations. Changes emit `AdditionalAgentPayoutPercentageUpdated`.
- `maxJobPayout` / `jobDurationLimit`: upper bounds for new jobs.
- `completionReviewPeriod` / `disputeReviewPeriod`: timeouts for `finalizeJob` and `resolveStaleDispute`.
- `premiumReputationThreshold`: threshold for `canAccessPremiumFeature`.

## Operational procedures

### Pausing
- `pause`/`unpause` are owner‑only.
- When paused:
  - Most job actions are blocked (`createJob`, `applyForJob`, validation, etc.).
  - `requestJobCompletion` remains available for assigned agents so completion metadata can be submitted even during a brief pause.
  - `resolveStaleDispute` and `withdrawAGI` require the contract to be paused.

### Managing allowlists
- **Merkle roots** are stored on-chain and can be updated by the owner via `updateMerkleRoots`. Treat updates as governance events with audit logs.
- **Explicit allowlists** can be modified at runtime via:
  - `addAdditionalAgent` / `removeAdditionalAgent`
  - `addAdditionalValidator` / `removeAdditionalValidator`
- **Blacklists** can be enforced via:
  - `blacklistAgent`
  - `blacklistValidator`

### Managing moderators
- `addModerator` / `removeModerator` are owner‑only.
- Moderators should be treated as trusted dispute arbiters.

### Managing AGI types
- `addAGIType(address nftAddress, uint256 payoutPercentage)` creates or updates an AGI type.
- The highest payout percentage among AGI types **plus** `validationRewardPercentage` must be ≤ 100.
- Agent payout percentage is snapshotted at assignment based on the highest AGI type the agent holds.

### Withdrawing ERC‑20
- `withdrawAGI(amount)` can only withdraw surplus balances; it fails if `balance < lockedEscrow` or `amount > withdrawableAGI()`.
- Withdrawals are only allowed while paused.

### Rotating the escrow token
- `updateAGITokenAddress` changes the ERC‑20 used for escrow, payouts, and reward pool contributions.
- Changing the token can break integrations and invalidate approvals. Ensure all users re‑approve the new token and carefully manage `lockedEscrow` vs balances before switching.
- **Production invariant**: treat the escrow token as immutable once jobs are funded. If your program has a canonical token (e.g., AGIALPHA), document the address in deployment records and avoid on-chain rotation outside test environments.

## Monitoring checklist

- Track `JobCreated`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobDisputed`, `JobCompleted`, `DisputeResolvedWithCode`, and `JobFinalized` for lifecycle visibility.
- Track `AGIWithdrawn` and `lockedEscrow` to ensure the contract remains solvent.
- Monitor `ReputationUpdated` to maintain off‑chain reputation views.

## Upgrade & recovery notes

- There is no upgradability pattern; any new version requires a new deployment.
- If a dispute becomes stale (no moderator action within `disputeReviewPeriod`), the owner can call `resolveStaleDispute` **only while paused**.
