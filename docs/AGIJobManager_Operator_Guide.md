# AGIJobManager Operator Guide

This runbook is for owners/operators deploying and maintaining the `AGIJobManager` contract.

## Deployment parameters (constructor)

The constructor requires:

1. `string _baseIpfsUrl` — base URL used to prefix non‑full token URIs.
2. `address _ensAddress` — ENS registry address.
3. `address _nameWrapperAddress` — ENS NameWrapper address.
4. `bytes32 _validatorMerkleRoot` — Merkle root for validator allowlist (leaf = `keccak256(abi.encodePacked(address))`).
5. `bytes32 _agentMerkleRoot` — Merkle root for agent allowlist (leaf = `keccak256(abi.encodePacked(address))`).

**Hard-coded invariants**:
- `agiToken` is fixed to `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`.
- ENS root nodes are fixed for both base and alpha namespaces (`clubRootNode`, `clubRootNodeAlpha`, `agentRootNode`, `agentRootNodeAlpha`).

The ERC‑721 token is initialized as `AGIJobs` / `Job`.

## Safe default parameters

Most parameters are upgradable by the owner. Token and ENS root nodes are fixed in-contract. Defaults are set in the contract to conservative values; operators should verify each one before deployment:

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
  - Most job actions are blocked (`createJob`, `applyForJob`, validation, listing/purchase, etc.).
  - `requestJobCompletion` is allowed **only** if the job is already disputed (to support recovery workflows).
  - `resolveStaleDispute` and `withdrawAGI` require the contract to be paused.

### Managing allowlists
- **Merkle roots** are fixed at deployment (no setter exists).
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

### Escrow token immutability
- `agiToken` is a compile-time constant and cannot be rotated after deployment.
- Ensure all integrations point to the fixed AGI token (`0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`).

## Monitoring checklist

- Track `JobCreated`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobDisputed`, `JobCompleted`, `DisputeResolvedWithCode`, and `JobFinalized` for lifecycle visibility.
- Track `AGIWithdrawn` and `lockedEscrow` to ensure the contract remains solvent.
- Monitor `ReputationUpdated` to maintain off‑chain reputation views.
- Monitor `RecoveryInitiated` for ENS/NameWrapper failures or dispute recovery actions.

## Upgrade & recovery notes

- There is no upgradability pattern; any new version requires a new deployment.
- If a dispute becomes stale (no moderator action within `disputeReviewPeriod`), the owner can call `resolveStaleDispute` **only while paused**.
