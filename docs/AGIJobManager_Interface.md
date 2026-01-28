# AGIJobManager Interface Reference

This file is derived from the compiled ABI (`build/contracts/AGIJobManager.json`) and the contract source. It covers all public/external functions, events, custom errors, and public state variables.

## Custom errors
These errors are used instead of revert strings. Integrators should decode error selectors to surface failures.

| Error | Meaning |
| --- | --- |
| `NotModerator()` | Caller is not a moderator. |
| `NotAuthorized()` | Caller is not permitted to perform the action. |
| `Blacklisted()` | Caller is blacklisted as agent/validator. |
| `InvalidParameters()` | Input values fail validation or a required amount is zero. |
| `InvalidState()` | Job or listing state does not allow the action. |
| `JobNotFound()` | Job ID does not exist (employer address is zero). |
| `TransferFailed()` | ERC-20 transfer/transferFrom returned false. |

## Events

| Event (indexed args shown) | Emitted when |
| --- | --- |
| `JobCreated(uint256 jobId, string ipfsHash, uint256 payout, uint256 duration, string details)` | A job is created. |
| `JobApplied(uint256 jobId, address agent)` | An agent applies and is assigned. |
| `JobCompletionRequested(uint256 jobId, address agent)` | Assigned agent requests completion. |
| `JobValidated(uint256 jobId, address validator)` | A validator approves a job. |
| `JobDisapproved(uint256 jobId, address validator)` | A validator disapproves a job. |
| `JobDisputed(uint256 jobId, address disputant)` | A dispute is opened or disapproval threshold is reached. |
| `DisputeResolved(uint256 jobId, address resolver, string resolution)` | Moderator resolves dispute. |
| `JobCompleted(uint256 jobId, address agent, uint256 reputationPoints)` | Job is completed via validation or dispute resolution. |
| `JobCancelled(uint256 jobId)` | Job is cancelled/delisted and deleted. |
| `ReputationUpdated(address user, uint256 newReputation)` | Reputation is recalculated/updated. |
| `OwnershipVerified(address claimant, string subdomain)` | Ownership verification succeeded. |
| `RecoveryInitiated(string reason)` | ENS/NameWrapper fallback path emitted a diagnostic reason. |
| `AGITypeUpdated(indexed address nftAddress, uint256 payoutPercentage)` | AGI type added or updated. |
| `NFTIssued(indexed uint256 tokenId, indexed address employer, string tokenURI)` | ERC-721 token minted to employer. |
| `NFTListed(indexed uint256 tokenId, indexed address seller, uint256 price)` | NFT listed in marketplace. |
| `NFTPurchased(indexed uint256 tokenId, indexed address buyer, uint256 price)` | NFT purchased. |
| `NFTDelisted(indexed uint256 tokenId)` | NFT listing delisted. |
| `RewardPoolContribution(indexed address contributor, uint256 amount)` | ERC-20 added to reward pool. |
| `RootNodeUpdated(indexed bytes32 newRootNode)` | **Declared but not emitted in current code.** |
| `MerkleRootUpdated(indexed bytes32 newMerkleRoot)` | **Declared but not emitted in current code.** |
| `Approval(indexed address owner, indexed address approved, indexed uint256 tokenId)` | ERC-721 approval (standard). |
| `ApprovalForAll(indexed address owner, indexed address operator, bool approved)` | ERC-721 approval-for-all (standard). |
| `Transfer(indexed address from, indexed address to, indexed uint256 tokenId)` | ERC-721 transfer (standard). |
| `MetadataUpdate(uint256 _tokenId)` | ERC-4906 metadata update (standard). |
| `BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId)` | ERC-4906 metadata update (standard). |
| `OwnershipTransferred(indexed address previousOwner, indexed address newOwner)` | Ownable transfer (standard). |
| `Paused(address account)` | Pausable pause (standard). |
| `Unpaused(address account)` | Pausable unpause (standard). |

## Public state variables

| Getter | Type | Meaning |
| --- | --- | --- |
| `agiToken()` | `address` | ERC-20 used for escrow and marketplace payments. |
| `requiredValidatorApprovals()` | `uint256` | Approvals needed to complete a job. |
| `requiredValidatorDisapprovals()` | `uint256` | Disapprovals needed to mark a job disputed. |
| `premiumReputationThreshold()` | `uint256` | Reputation threshold for premium features. |
| `validationRewardPercentage()` | `uint256` | % of payout reserved for validators. |
| `maxJobPayout()` | `uint256` | Maximum allowed payout for a job. |
| `jobDurationLimit()` | `uint256` | Maximum allowed job duration. |
| `termsAndConditionsIpfsHash()` | `string` | Terms hash string (admin-set). |
| `contactEmail()` | `string` | Contact email string (admin-set). |
| `additionalText1()` | `string` | Admin text field. |
| `additionalText2()` | `string` | Admin text field. |
| `additionalText3()` | `string` | Admin text field. |
| `clubRootNode()` | `bytes32` | ENS root node for validator subdomains. |
| `agentRootNode()` | `bytes32` | ENS root node for agent subdomains. |
| `validatorMerkleRoot()` | `bytes32` | Merkle root for validators. |
| `agentMerkleRoot()` | `bytes32` | Merkle root for agents. |
| `ens()` | `address` | ENS registry address. |
| `nameWrapper()` | `address` | ENS NameWrapper address. |
| `nextJobId()` | `uint256` | Next job ID to allocate. |
| `nextTokenId()` | `uint256` | Next ERC-721 token ID to mint. |
| `jobs(uint256)` | `Job` | Job fields (does not expose mappings/arrays). |
| `reputation(address)` | `uint256` | Reputation for a user. |
| `moderators(address)` | `bool` | Moderator allowlist. |
| `additionalValidators(address)` | `bool` | Validator allowlist bypass. |
| `additionalAgents(address)` | `bool` | Agent allowlist bypass. |
| `validatorApprovedJobs(address,uint256)` | `uint256` | Job IDs a validator has voted on. |
| `listings(uint256)` | `Listing` | Marketplace listing state. |
| `blacklistedAgents(address)` | `bool` | Blacklisted agents. |
| `blacklistedValidators(address)` | `bool` | Blacklisted validators. |
| `agiTypes(uint256)` | `AGIType` | AGI type list (NFT address + payout %). |

## Functions

### Job lifecycle

- `createJob(string _ipfsHash, uint256 _payout, uint256 _duration, string _details)` (nonpayable)
  - Reverts: `InvalidParameters`, `TransferFailed`.
  - Effects: creates a new job, stores details, pulls escrow, emits `JobCreated`.

- `applyForJob(uint256 _jobId, string subdomain, bytes32[] proof)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `Blacklisted`, `NotAuthorized`.
  - Effects: sets `assignedAgent` + `assignedAt`, emits `JobApplied`.

- `requestJobCompletion(uint256 _jobId, string _ipfsHash)` (nonpayable)
  - Reverts: `JobNotFound`, `NotAuthorized`, `InvalidState` (if past duration).
  - Effects: updates job IPFS hash, sets `completionRequested`, emits `JobCompletionRequested`.

- `validateJob(uint256 _jobId, string subdomain, bytes32[] proof)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `Blacklisted`, `NotAuthorized`.
  - Effects: records approval, emits `JobValidated`, may call `_completeJob`.

- `disapproveJob(uint256 _jobId, string subdomain, bytes32[] proof)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `Blacklisted`, `NotAuthorized`.
  - Effects: records disapproval, emits `JobDisapproved`, may set `disputed` and emit `JobDisputed`.

- `disputeJob(uint256 _jobId)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `NotAuthorized`.
  - Effects: sets `disputed`, emits `JobDisputed`.

- `resolveDispute(uint256 _jobId, string resolution)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `NotModerator`, `TransferFailed`.
  - Effects: if resolution is `"agent win"` → completes job; if `"employer win"` → refunds employer + marks completed; clears dispute and emits `DisputeResolved`.

- `cancelJob(uint256 _jobId)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `NotAuthorized`, `TransferFailed`.
  - Effects: refunds employer, deletes job, emits `JobCancelled`.

- `delistJob(uint256 _jobId)` (nonpayable)
  - Reverts: `JobNotFound`, `InvalidState`, `TransferFailed`.
  - Effects: refunds employer, deletes job, emits `JobCancelled`.

- `getJobStatus(uint256 _jobId)` (view) → `(bool completed, bool completionRequested, string ipfsHash)`
  - Note: does **not** revert if job does not exist; returns default values for empty storage.

### Reputation & premium

- `canAccessPremiumFeature(address user)` (view) → `bool`
- `reputation(address user)` (view) → `uint256`

### Validators & allowlists

- `addAdditionalValidator(address validator)` (nonpayable) — owner only
- `removeAdditionalValidator(address validator)` (nonpayable) — owner only
- `addAdditionalAgent(address agent)` (nonpayable) — owner only
- `removeAdditionalAgent(address agent)` (nonpayable) — owner only
- `blacklistAgent(address _agent, bool _status)` (nonpayable) — owner only
- `blacklistValidator(address _validator, bool _status)` (nonpayable) — owner only

### Parameters & admin metadata

- `updateAGITokenAddress(address _newTokenAddress)` (nonpayable) — owner only
- `setBaseIpfsUrl(string _url)` (nonpayable) — owner only
- `setRequiredValidatorApprovals(uint256 _approvals)` (nonpayable) — owner only
- `setRequiredValidatorDisapprovals(uint256 _disapprovals)` (nonpayable) — owner only
- `setPremiumReputationThreshold(uint256 _threshold)` (nonpayable) — owner only
- `setMaxJobPayout(uint256 _maxPayout)` (nonpayable) — owner only
- `setJobDurationLimit(uint256 _limit)` (nonpayable) — owner only
- `setValidationRewardPercentage(uint256 _percentage)` (nonpayable) — owner only; reverts `InvalidParameters` if `percentage == 0` or `percentage > 100`.
- `updateTermsAndConditionsIpfsHash(string _hash)` (nonpayable) — owner only
- `updateContactEmail(string _email)` (nonpayable) — owner only
- `updateAdditionalText1(string _text)` (nonpayable) — owner only
- `updateAdditionalText2(string _text)` (nonpayable) — owner only
- `updateAdditionalText3(string _text)` (nonpayable) — owner only

### Reward pool / treasury

- `contributeToRewardPool(uint256 amount)` (nonpayable)
  - Reverts: `InvalidParameters`, `TransferFailed`.
  - Effects: pulls ERC-20 into contract, emits `RewardPoolContribution`.

- `withdrawAGI(uint256 amount)` (nonpayable) — owner only
  - Reverts: `InvalidParameters`, `TransferFailed`.
  - Effects: transfers ERC-20 from contract to owner.

### AGI types

- `addAGIType(address nftAddress, uint256 payoutPercentage)` (nonpayable)
  - Reverts: `InvalidParameters`.
  - Effects: adds or updates AGI type, emits `AGITypeUpdated`.

- `getHighestPayoutPercentage(address agent)` (view) → `uint256`
  - Reads ERC-721 balances across `agiTypes` and returns the max payout percentage.

### NFT marketplace

- `listNFT(uint256 tokenId, uint256 price)` (nonpayable)
  - Reverts: `NotAuthorized`, `InvalidParameters`.
  - Effects: sets listing active, emits `NFTListed`.

- `purchaseNFT(uint256 tokenId)` (nonpayable)
  - Reverts: `InvalidState`, `TransferFailed`.
  - Effects: transfers ERC-20 payment and NFT, emits `NFTPurchased`.

- `delistNFT(uint256 tokenId)` (nonpayable)
  - Reverts: `NotAuthorized`.
  - Effects: disables listing, emits `NFTDelisted`.

### Pausable

- `pause()` / `unpause()` (nonpayable) — owner only

### ERC-721 / ERC-165 / Ownable

All standard ERC-721 functions are exposed (name, symbol, balanceOf, ownerOf, approve, getApproved, setApprovalForAll, isApprovedForAll, transferFrom, safeTransferFrom, tokenURI) plus `supportsInterface` and Ownable functions (`owner`, `transferOwnership`, `renounceOwnership`). These follow OpenZeppelin’s revert behavior for missing tokens and unauthorized transfers.
