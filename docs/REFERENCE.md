# AGIJobManager Reference (Public/External Surface)

This is a function‑by‑function reference of the deployed contract’s public/external interface. It is derived from the contract source and ABI.

## Read‑only getters (auto‑generated)
The following `public` state variables have auto‑generated getter functions:
- `agiToken()`, `baseIpfsUrl()`
- `requiredValidatorApprovals()`, `requiredValidatorDisapprovals()`
- `premiumReputationThreshold()`, `validationRewardPercentage()`
- `maxJobPayout()`, `jobDurationLimit()`
- `termsAndConditionsIpfsHash()`, `contactEmail()`, `additionalText1/2/3()`
- `clubRootNode()`, `agentRootNode()`, `validatorMerkleRoot()`, `agentMerkleRoot()`
- `ens()`, `nameWrapper()`
- `nextJobId()`, `nextTokenId()`
- `jobs(jobId)` (struct summary)
- `reputation(address)`
- `moderators(address)`
- `additionalValidators(address)`, `additionalAgents(address)`
- `validatorApprovedJobs(address, index)`
- `listings(tokenId)`
- `blacklistedAgents(address)`, `blacklistedValidators(address)`
- `agiTypes(index)`

## Core workflow
### `createJob(string ipfsHash, uint256 payout, uint256 duration, string details)`
Escrows `payout` tokens and creates a job. Emits `JobCreated`.

### `applyForJob(uint256 jobId, string subdomain, bytes32[] proof)`
Assigns the agent if identity checks pass. The agent payout tier is **snapshotted at assignment time** and stored on the job. Agents without a payout tier (0%) cannot apply, even if allowlisted via `additionalAgents`. Emits `JobApplied`.

### `requestJobCompletion(uint256 jobId, string ipfsHash)`
Marks completion requested and updates the job’s `ipfsHash`. Emits `JobCompletionRequested`.

### `validateJob(uint256 jobId, string subdomain, bytes32[] proof)`
Validator approval. Emits `JobValidated`. When approvals reach threshold, completes the job.

### `disapproveJob(uint256 jobId, string subdomain, bytes32[] proof)`
Validator disapproval. Emits `JobDisapproved`. When disapprovals reach threshold, marks disputed and emits `JobDisputed`.

### `disputeJob(uint256 jobId)`
Marks a job disputed (employer or assigned agent only). Emits `JobDisputed`.

### `resolveDispute(uint256 jobId, string resolution)`
Moderator only. If `resolution` is exactly `"agent win"`, job completes and payouts occur. If `"employer win"`, payout is refunded to employer and job closes. Emits `DisputeResolved`.

### `cancelJob(uint256 jobId)`
Employer only. Cancels if no agent assigned and not completed. Emits `JobCancelled`.

## NFT marketplace
### `listNFT(uint256 tokenId, uint256 price)`
Lists an employer‑owned NFT for sale. Emits `NFTListed`.

### `purchaseNFT(uint256 tokenId)`
Transfers AGI tokens from buyer to seller and transfers the NFT. Emits `NFTPurchased`.

### `delistNFT(uint256 tokenId)`
Seller removes the listing. Emits `NFTDelisted`.

## Admin operations
### `pause()` / `unpause()`
Stops/starts most user actions.

### `blacklistAgent(address agent, bool status)`
### `blacklistValidator(address validator, bool status)`
Blocks specific agents/validators from applying/validating.

### `addModerator(address)` / `removeModerator(address)`
Manages moderator permissions.

### `addAdditionalAgent(address)` / `removeAdditionalAgent(address)`
### `addAdditionalValidator(address)` / `removeAdditionalValidator(address)`
Explicit allowlists for roles, bypassing ENS/Merkle checks.

### `updateAGITokenAddress(address)`
Changes the ERC‑20 token used for payouts.

### `setBaseIpfsUrl(string)`
Base prefix for minted NFT tokenURIs.

### `setRequiredValidatorApprovals(uint256)`
### `setRequiredValidatorDisapprovals(uint256)`
Sets approval/disapproval thresholds.

### `setValidationRewardPercentage(uint256)`
Sets validator reward percentage (1‑100).

### `setPremiumReputationThreshold(uint256)`
Sets the reputation required for premium feature access.

### `setMaxJobPayout(uint256)`
Sets max payout allowed.

### `setJobDurationLimit(uint256)`
Sets max job duration allowed.

### `updateTermsAndConditionsIpfsHash(string)`
### `updateContactEmail(string)`
### `updateAdditionalText1/2/3(string)`
Updates informational metadata fields.

### `withdrawAGI(uint256 amount)`
Withdraws surplus AGI tokens held by the contract while paused. Reverts if `amount > withdrawableAGI()`.

### `contributeToRewardPool(uint256 amount)`
Transfers tokens to the contract and emits `RewardPoolContribution`.

### `addAGIType(address nftAddress, uint256 payoutPercentage)`
Adds or updates an AGIType NFT that boosts agent payout percentage. Emits `AGITypeUpdated`.

## View helpers
### `getJobStatus(uint256 jobId)`
Returns `(completed, completionRequested, ipfsHash)`.

### `lockedEscrow()`
Returns the total AGI reserved for unsettled job escrows.

### `withdrawableAGI()`
Returns the surplus AGI balance (`balance - lockedEscrow`). Reverts if balance is below `lockedEscrow`.

### `canAccessPremiumFeature(address user)`
Returns true if reputation exceeds `premiumReputationThreshold`.

### `getHighestPayoutPercentage(address agent)`
Returns the highest payout percentage from AGIType NFTs owned by the agent.

## Events
Key events to index:
- `JobCreated`, `JobApplied`, `JobCompletionRequested`
- `JobValidated`, `JobDisapproved`, `JobDisputed`, `DisputeResolved`
- `JobCompleted`, `NFTIssued`, `JobCancelled`
- `ReputationUpdated`, `OwnershipVerified`, `RecoveryInitiated`
- `NFTListed`, `NFTPurchased`, `NFTDelisted`
- `RewardPoolContribution`, `AGITypeUpdated`

## Custom errors (gas‑efficient reverts)
- `NotModerator`
- `NotAuthorized`
- `Blacklisted`
- `InvalidParameters`
- `InvalidState`
- `JobNotFound`
- `TransferFailed`
- `ValidatorLimitReached`
- `InvalidValidatorThresholds`
- `ValidatorSetTooLarge`
- `IneligibleAgentPayout`
- `InvalidAgentPayoutSnapshot`
- `InsufficientWithdrawableBalance`
- `InsolventEscrowBalance`
