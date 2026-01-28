# AGIJobManager Operator Guide

This guide focuses on deployment, configuration, and operational practices for `AGIJobManager`.

## Deployment parameters (constructor)
The constructor requires:

1. `address _agiTokenAddress` — ERC-20 used for escrow and payouts.
2. `string _baseIpfsUrl` — Base URL used for job NFT tokenURIs.
3. `address _ensAddress` — ENS registry address.
4. `address _nameWrapperAddress` — ENS NameWrapper address.
5. `bytes32 _clubRootNode` — ENS namehash (root node) for validator checks.
6. `bytes32 _agentRootNode` — ENS namehash (root node) for agent checks.
7. `bytes32 _validatorMerkleRoot` — Merkle root for validator allowlist.
8. `bytes32 _agentMerkleRoot` — Merkle root for agent allowlist.

> Note: There are **no** public functions to update root nodes or Merkle roots after deployment; set them correctly before deploying.

## Default parameters (current values)
The contract’s initial values are:
- `requiredValidatorApprovals = 3`
- `requiredValidatorDisapprovals = 3`
- `premiumReputationThreshold = 10000`
- `validationRewardPercentage = 8`
- `maxJobPayout = 4888e18`
- `jobDurationLimit = 10000000`

## Operational configuration
### Admin controls (owner-only)
- **Pause/unpause**
  - `pause` and `unpause` use OpenZeppelin `Pausable`.
  - `whenNotPaused` affects: `createJob`, `applyForJob`, `requestJobCompletion`, `validateJob`, `disapproveJob`, `disputeJob`, and `contributeToRewardPool`.
  - Other functions (including `cancelJob`, `resolveDispute`, and NFT listings) are not paused.

- **Parameters**
  - `setRequiredValidatorApprovals` / `setRequiredValidatorDisapprovals`: adjust validation thresholds.
  - `setValidationRewardPercentage`: percentage of payout allocated to validators (1–100).
  - `setPremiumReputationThreshold`: minimum reputation for premium access via `canAccessPremiumFeature`.
  - `setMaxJobPayout` and `setJobDurationLimit`: hard limits enforced on `createJob`.
  - `setBaseIpfsUrl`: affects new NFT tokenURIs.

- **Metadata fields**
  - `updateTermsAndConditionsIpfsHash`, `updateContactEmail`, `updateAdditionalText1/2/3`: update public text fields.

- **Roles and allowlists**
  - Moderators: `addModerator` / `removeModerator`.
  - Explicit allowlists: `addAdditionalAgent`, `removeAdditionalAgent`, `addAdditionalValidator`, `removeAdditionalValidator`.
  - Blacklists: `blacklistAgent`, `blacklistValidator`.

- **AGI types**
  - `addAGIType(nftAddress, payoutPercentage)` adds or updates a payout multiplier tied to owning an ERC-721.
  - Ensure `nftAddress` is a real ERC-721; `getHighestPayoutPercentage` calls `IERC721.balanceOf`.

- **Token rotation**
  - `updateAGITokenAddress` changes the ERC-20 used for escrow and payouts.
  - **Operational warning**: changing tokens does not convert existing escrow balances. Ensure the contract holds enough of the new token or drain funds before rotating.

- **Withdrawals**
  - `withdrawAGI(amount)` allows the owner to move ERC-20 balance out of the contract.
  - It reverts on `amount == 0` or `amount > balance`.

### Job controls
- Employers can `cancelJob` before assignment (refunds escrow, deletes job).
- Owners can `delistJob` before assignment (refunds escrow, deletes job). This is intended for administrative rollback.

## Operational runbook (suggested)
1. **Deploy** with correct ENS and Merkle roots.
2. **Set base IPFS URL** to align with job metadata storage.
3. **Configure thresholds** (`requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `validationRewardPercentage`).
4. **Populate allowlists** or ensure Merkle roots are correct.
5. **Assign moderators** for dispute resolution.
6. **Monitor escrow balance** and use `withdrawAGI` carefully.
7. **Review dispute resolutions**: use canonical strings exactly (`"agent win"`, `"employer win"`).

## Common failure modes
- **Incorrect Merkle root**: agents/validators cannot apply or vote.
- **Wrong ENS/NameWrapper address**: ownership checks fail and emit `RecoveryInitiated` events.
- **Token rotation mismatch**: escrowed balance remains in old ERC-20.
- **Zero validator count**: no validator rewards are distributed on completion.
- **Agent with no AGI type**: agent payout percentage can be zero.

