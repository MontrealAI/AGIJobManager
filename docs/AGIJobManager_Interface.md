# AGIJobManager Interface Reference

This reference is based on the compiled ABI (`build/contracts/AGIJobManager.json`) and the implementation at `contracts/AGIJobManager.sol`.

## Contract summary
- **Name / symbol**: `AGIJobs` / `Job`
- **Inherits**: `Ownable`, `ReentrancyGuard`, `Pausable`, `ERC721URIStorage`
- **Token**: Uses an external ERC-20 (`agiToken`) for escrow and payouts.

## Custom errors
Custom errors are emitted as error selectors (not revert strings). Integrators should decode these selectors to obtain the error name.

| Error | Meaning |
| --- | --- |
| `NotModerator()` | Caller is not a moderator. |
| `NotAuthorized()` | Caller is not authorized for this action (ownership/role requirement failed). |
| `Blacklisted()` | Caller is blacklisted as an agent or validator. |
| `InvalidParameters()` | Supplied parameters failed validation checks. |
| `InvalidState()` | Job is not in the required state, or the action is not allowed in the current state. |
| `JobNotFound()` | Job ID does not exist. |
| `TransferFailed()` | ERC-20 transfer or transferFrom returned `false`. |

## Events
Indexing information is taken from the compiled ABI.

### AGIJobManager events
| Event | Indexed fields | Emitted when | Consumer notes |
| --- | --- | --- | --- |
| `JobCreated(uint256 jobId, string ipfsHash, uint256 payout, uint256 duration, string details)` | None | `createJob` succeeds. | Use as the canonical job creation signal. |
| `JobApplied(uint256 jobId, address agent)` | None | Agent assignment in `applyForJob`. | Indicates job is now assigned. |
| `JobCompletionRequested(uint256 jobId, address agent)` | None | Assigned agent calls `requestJobCompletion`. | `ipfsHash` is updated before this event. |
| `JobValidated(uint256 jobId, address validator)` | None | Validator approves in `validateJob`. | Emits once per validator. |
| `JobDisapproved(uint256 jobId, address validator)` | None | Validator disapproves in `disapproveJob`. | Emits once per validator. |
| `JobCompleted(uint256 jobId, address agent, uint256 reputationPoints)` | None | `_completeJob` finishes. | Indicates payouts + reputation updates occurred. |
| `ReputationUpdated(address user, uint256 newReputation)` | None | `enforceReputationGrowth` runs. | Emitted for agents and validators. |
| `JobCancelled(uint256 jobId)` | None | `cancelJob` or `delistJob` succeeds. | Job storage is deleted after refund. |
| `DisputeResolved(uint256 jobId, address resolver, string resolution)` | None | `resolveDispute` succeeds. | Only canonical resolutions trigger payout/refund. |
| `JobDisputed(uint256 jobId, address disputant)` | None | `disputeJob` or disapproval threshold hit. | Dispute may be resolved later by moderator. |
| `RootNodeUpdated(bytes32 newRootNode)` | `newRootNode` | **Never emitted** (no setters). | Present in ABI only. |
| `MerkleRootUpdated(bytes32 newMerkleRoot)` | `newMerkleRoot` | **Never emitted** (no setters). | Present in ABI only. |
| `OwnershipVerified(address claimant, string subdomain)` | None | `_verifyOwnership` succeeds. | Informational signal for allowlist/ENS checks. |
| `RecoveryInitiated(string reason)` | None | `_verifyOwnership` encounters ENS/NameWrapper failure paths. | Informational only; authorization may still fail. |
| `AGITypeUpdated(address nftAddress, uint256 payoutPercentage)` | `nftAddress` | `addAGIType` adds or updates. | Track AGI payout multipliers. |
| `NFTIssued(uint256 tokenId, address employer, string tokenURI)` | `tokenId`, `employer` | `_completeJob` mints a job NFT. | Track token URIs for finished jobs. |
| `NFTListed(uint256 tokenId, address seller, uint256 price)` | `tokenId`, `seller` | `listNFT` succeeds. | Listing is not escrowed. |
| `NFTPurchased(uint256 tokenId, address buyer, uint256 price)` | `tokenId`, `buyer` | `purchaseNFT` succeeds. | Listing is cleared. |
| `NFTDelisted(uint256 tokenId)` | `tokenId` | `delistNFT` succeeds. | Listing is cleared without transfer. |
| `RewardPoolContribution(address contributor, uint256 amount)` | `contributor` | `contributeToRewardPool` succeeds. | No automated distribution logic. |

### ERC-721 / Ownable / Pausable events
| Event | Indexed fields | Emitted when |
| --- | --- | --- |
| `Transfer(address from, address to, uint256 tokenId)` | `from`, `to`, `tokenId` | ERC-721 transfers and mints/burns. |
| `Approval(address owner, address approved, uint256 tokenId)` | `owner`, `approved`, `tokenId` | ERC-721 approvals. |
| `ApprovalForAll(address owner, address operator, bool approved)` | `owner`, `operator` | Operator approvals. |
| `MetadataUpdate(uint256 _tokenId)` | None | ERC-4906 metadata updates (emitted by `_setTokenURI`). |
| `BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId)` | None | ERC-4906 batch metadata updates. |
| `OwnershipTransferred(address previousOwner, address newOwner)` | `previousOwner`, `newOwner` | `transferOwnership` or `renounceOwnership`. |
| `Paused(address account)` | None | `pause` succeeds. |
| `Unpaused(address account)` | None | `unpause` succeeds. |

## Public state variables
The following public getters are generated by Solidity for state variables:

### Escrow & configuration
- `agiToken() -> address`
- `requiredValidatorApprovals() -> uint256`
- `requiredValidatorDisapprovals() -> uint256`
- `premiumReputationThreshold() -> uint256`
- `validationRewardPercentage() -> uint256`
- `maxJobPayout() -> uint256`
- `jobDurationLimit() -> uint256`
- `termsAndConditionsIpfsHash() -> string`
- `contactEmail() -> string`
- `additionalText1() -> string`
- `additionalText2() -> string`
- `additionalText3() -> string`

### ENS / allowlist
- `clubRootNode() -> bytes32`
- `agentRootNode() -> bytes32`
- `validatorMerkleRoot() -> bytes32`
- `agentMerkleRoot() -> bytes32`
- `ens() -> address`
- `nameWrapper() -> address`
- `additionalValidators(address) -> bool`
- `additionalAgents(address) -> bool`

### Jobs & reputation
- `nextJobId() -> uint256`
- `jobs(uint256) -> (uint256 id, address employer, string ipfsHash, uint256 payout, uint256 duration, address assignedAgent, uint256 assignedAt, bool completed, bool completionRequested, uint256 validatorApprovals, uint256 validatorDisapprovals, bool disputed, string details)`
- `reputation(address) -> uint256`
- `validatorApprovedJobs(address, uint256) -> uint256`
- `blacklistedAgents(address) -> bool`
- `blacklistedValidators(address) -> bool`
- `moderators(address) -> bool`

### NFT listings and AGI types
- `listings(uint256) -> (uint256 tokenId, address seller, uint256 price, bool isActive)`
- `agiTypes(uint256) -> (address nftAddress, uint256 payoutPercentage)`
- `nextTokenId() -> uint256`

### ERC-721 standard
- `name() -> string`
- `symbol() -> string`
- `owner() -> address`
- `paused() -> bool`

## Function access table
This table maps **every function** in the ABI to its caller role, key preconditions, and primary effects.

### Views & pure functions (any caller)
| Function | Who can call | Preconditions / reverts | Effects |
| --- | --- | --- | --- |
| `agiToken()` | Anyone | None | Returns ERC-20 address. |
| `additionalAgents(address)` | Anyone | None | Returns allowlist flag. |
| `additionalValidators(address)` | Anyone | None | Returns allowlist flag. |
| `agentMerkleRoot()` | Anyone | None | Returns agent Merkle root. |
| `agentRootNode()` | Anyone | None | Returns agent root node. |
| `agiTypes(uint256)` | Anyone | Reverts on out-of-range index. | Returns AGI type by index. |
| `balanceOf(address)` | Anyone | Standard ERC-721 (reverts on zero address). | Returns NFT balance. |
| `blacklistedAgents(address)` | Anyone | None | Returns blacklist flag. |
| `blacklistedValidators(address)` | Anyone | None | Returns blacklist flag. |
| `clubRootNode()` | Anyone | None | Returns validator root node. |
| `contactEmail()` | Anyone | None | Returns contact email. |
| `ens()` | Anyone | None | Returns ENS registry address. |
| `getApproved(uint256)` | Anyone | Token must exist (ERC-721 revert). | Returns approved address. |
| `getJobStatus(uint256)` | Anyone | None (missing job returns default values). | Returns `(completed, completionRequested, ipfsHash)`. |
| `getHighestPayoutPercentage(address)` | Anyone | None | Returns highest AGI-type payout percentage. |
| `isApprovedForAll(address,address)` | Anyone | None | Returns operator approval. |
| `jobDurationLimit()` | Anyone | None | Returns max job duration. |
| `jobs(uint256)` | Anyone | None (zero-address employer means missing). | Returns public job fields. |
| `listings(uint256)` | Anyone | None | Returns listing state. |
| `maxJobPayout()` | Anyone | None | Returns max payout. |
| `moderators(address)` | Anyone | None | Returns moderator flag. |
| `name()` | Anyone | None | ERC-721 name. |
| `nameWrapper()` | Anyone | None | ENS NameWrapper address. |
| `nextJobId()` | Anyone | None | Returns next job ID. |
| `nextTokenId()` | Anyone | None | Returns next token ID. |
| `owner()` | Anyone | None | Returns contract owner. |
| `ownerOf(uint256)` | Anyone | Token must exist (ERC-721 revert). | Returns token owner. |
| `paused()` | Anyone | None | Returns pause state. |
| `premiumReputationThreshold()` | Anyone | None | Returns premium threshold. |
| `reputation(address)` | Anyone | None | Returns reputation. |
| `requiredValidatorApprovals()` | Anyone | None | Returns approval threshold. |
| `requiredValidatorDisapprovals()` | Anyone | None | Returns disapproval threshold. |
| `supportsInterface(bytes4)` | Anyone | None | ERC-165 support. |
| `symbol()` | Anyone | None | ERC-721 symbol. |
| `termsAndConditionsIpfsHash()` | Anyone | None | Returns terms hash. |
| `tokenURI(uint256)` | Anyone | Token must exist (ERC-721 revert). | Returns token URI. |
| `validationRewardPercentage()` | Anyone | None | Returns validator reward percentage. |
| `validatorApprovedJobs(address,uint256)` | Anyone | Reverts on out-of-range index. | Returns job ID at index. |
| `validatorMerkleRoot()` | Anyone | None | Returns validator Merkle root. |
| `canAccessPremiumFeature(address)` | Anyone | None | Returns whether reputation meets threshold. |

### Job creation and lifecycle
| Function | Who can call | Preconditions / reverts | Effects |
| --- | --- | --- | --- |
| `createJob(string,uint256,uint256,string)` | Employer | `whenNotPaused`, `payout > 0`, `duration > 0`, `payout <= maxJobPayout`, `duration <= jobDurationLimit`, `transferFrom` succeeds (`TransferFailed`) | Transfers ERC-20 into escrow, initializes job, emits `JobCreated`. |
| `applyForJob(uint256,string,bytes32[])` | Agent | `whenNotPaused`, job exists (`JobNotFound`), unassigned (`InvalidState`), not blacklisted (`Blacklisted`), eligible via allowlist or ownership check (`NotAuthorized`) | Assigns agent, sets `assignedAt`, emits `JobApplied`. |
| `requestJobCompletion(uint256,string)` | Assigned agent | `whenNotPaused`, job exists (`JobNotFound`), caller is assigned agent (`NotAuthorized`), before `assignedAt + duration` (`InvalidState`) | Updates job IPFS hash, sets `completionRequested`, emits `JobCompletionRequested`. |
| `validateJob(uint256,string,bytes32[])` | Validator | `whenNotPaused`, job exists (`JobNotFound`), assigned & not completed (`InvalidState`), not blacklisted (`Blacklisted`), eligible (`NotAuthorized`), no prior vote (`InvalidState`) | Records approval + validator list, emits `JobValidated`; if threshold met, completes job. |
| `disapproveJob(uint256,string,bytes32[])` | Validator | `whenNotPaused`, job exists (`JobNotFound`), assigned & not completed (`InvalidState`), not blacklisted (`Blacklisted`), eligible (`NotAuthorized`), no prior vote (`InvalidState`) | Records disapproval + validator list, emits `JobDisapproved`; if threshold met, marks disputed + emits `JobDisputed`. |
| `disputeJob(uint256)` | Employer or assigned agent | `whenNotPaused`, job exists (`JobNotFound`), not completed or already disputed (`InvalidState`), caller is employer or agent (`NotAuthorized`) | Sets `disputed`, emits `JobDisputed`. |
| `resolveDispute(uint256,string)` | Moderator | Job exists (`JobNotFound`), caller is moderator (`NotModerator`), job disputed (`InvalidState`) | Canonical resolutions trigger completion or refund; dispute flag cleared; emits `DisputeResolved`. |
| `cancelJob(uint256)` | Employer | Job exists (`JobNotFound`), caller is employer (`NotAuthorized`), job unassigned & not completed (`InvalidState`) | Refunds employer, deletes job, emits `JobCancelled`. |
| `delistJob(uint256)` | Owner | Job exists (`JobNotFound`), job unassigned & not completed (`InvalidState`) | Refunds employer, deletes job, emits `JobCancelled`. |

### Reputation & incentives
| Function | Who can call | Preconditions / reverts | Effects |
| --- | --- | --- | --- |
| `setPremiumReputationThreshold(uint256)` | Owner | None | Updates premium threshold. |
| `setValidationRewardPercentage(uint256)` | Owner | `percentage > 0 && percentage <= 100` (`InvalidParameters`) | Updates validator reward percentage. |
| `addAGIType(address,uint256)` | Owner | `nftAddress != 0` and `payoutPercentage` 1–100 (`InvalidParameters`) | Adds or updates AGI type; emits `AGITypeUpdated`. |
| `getHighestPayoutPercentage(address)` | Anyone | None | Returns highest payout percentage based on AGI-type NFT balances. |
| `contributeToRewardPool(uint256)` | Anyone | `whenNotPaused`, `amount > 0` (`InvalidParameters`), `transferFrom` succeeds (`TransferFailed`) | Transfers ERC-20 into contract, emits `RewardPoolContribution`. |

### Admin & access control
| Function | Who can call | Preconditions / reverts | Effects |
| --- | --- | --- | --- |
| `pause()` | Owner | None | Pauses whenNotPaused functions, emits `Paused`. |
| `unpause()` | Owner | None | Unpauses, emits `Unpaused`. |
| `addModerator(address)` | Owner | None | Adds moderator. |
| `removeModerator(address)` | Owner | None | Removes moderator. |
| `blacklistAgent(address,bool)` | Owner | None | Sets agent blacklist status. |
| `blacklistValidator(address,bool)` | Owner | None | Sets validator blacklist status. |
| `addAdditionalAgent(address)` | Owner | None | Adds agent allowlist override. |
| `removeAdditionalAgent(address)` | Owner | None | Removes agent allowlist override. |
| `addAdditionalValidator(address)` | Owner | None | Adds validator allowlist override. |
| `removeAdditionalValidator(address)` | Owner | None | Removes validator allowlist override. |
| `updateAGITokenAddress(address)` | Owner | None | Updates ERC-20 used for escrow/payouts. |
| `setBaseIpfsUrl(string)` | Owner | None | Updates base IPFS URL used for new NFTs. |
| `setRequiredValidatorApprovals(uint256)` | Owner | None | Updates approval threshold. |
| `setRequiredValidatorDisapprovals(uint256)` | Owner | None | Updates disapproval threshold. |
| `setMaxJobPayout(uint256)` | Owner | None | Updates max allowed payout. |
| `setJobDurationLimit(uint256)` | Owner | None | Updates max allowed duration. |
| `updateTermsAndConditionsIpfsHash(string)` | Owner | None | Updates public T&C hash. |
| `updateContactEmail(string)` | Owner | None | Updates public contact email. |
| `updateAdditionalText1(string)` | Owner | None | Updates public text field 1. |
| `updateAdditionalText2(string)` | Owner | None | Updates public text field 2. |
| `updateAdditionalText3(string)` | Owner | None | Updates public text field 3. |
| `withdrawAGI(uint256)` | Owner | `amount > 0` and `amount <= token balance` (`InvalidParameters`) | Transfers ERC-20 out of contract; reverts on `TransferFailed`. |
| `transferOwnership(address)` | Owner | New owner not zero | Transfers ownership. |
| `renounceOwnership()` | Owner | None | Renounces ownership. |

### NFT marketplace
| Function | Who can call | Preconditions / reverts | Effects |
| --- | --- | --- | --- |
| `listNFT(uint256,uint256)` | Token owner | Owns token (`NotAuthorized`), `price > 0` (`InvalidParameters`) | Creates listing, emits `NFTListed`. |
| `purchaseNFT(uint256)` | Buyer | Listing active (`InvalidState`), `transferFrom` succeeds (`TransferFailed`) | Transfers ERC-20 from buyer to seller and transfers NFT to buyer; deactivates listing; emits `NFTPurchased`. |
| `delistNFT(uint256)` | Seller | Listing active and caller is seller (`NotAuthorized`) | Deactivates listing; emits `NFTDelisted`. |

### ERC-721 standard functions
| Function | Who can call | Preconditions | Effects |
| --- | --- | --- | --- |
| `approve(address,uint256)` | Token owner/approved | Token exists | Approves operator for token, emits `Approval`. |
| `setApprovalForAll(address,bool)` | Token owner | None | Sets operator approval, emits `ApprovalForAll`. |
| `transferFrom(address,address,uint256)` | Owner/approved | Token exists | Transfers token, emits `Transfer`. |
| `safeTransferFrom(address,address,uint256)` | Owner/approved | Token exists | Safe transfer; calls `onERC721Received` if needed. |
| `safeTransferFrom(address,address,uint256,bytes)` | Owner/approved | Token exists | Safe transfer with data. |

## Behavioral notes and error mapping
- **Job existence**: functions using `_job` will revert with `JobNotFound` if `job.employer == address(0)`.
- **Eligibility**: `applyForJob`, `validateJob`, and `disapproveJob` check `additionalAgents/additionalValidators` OR `_verifyOwnership` (Merkle + ENS/NameWrapper paths).
- **Dispute resolution strings**:
  - `"agent win"` triggers full completion logic.
  - `"employer win"` refunds and marks `completed = true`.
  - Other strings just close the dispute.
- **Event indexing**: Most job events are **not indexed**. NFT events include indexed `tokenId` and participants.
- **Validator arrays**: both approvals and disapprovals append to `validators` and `validatorApprovedJobs`, and payouts are split across this combined list.
