# AGIJobManager interface reference

> Generated from `build/contracts/AGIJobManager.json`. Regenerate with:
>
> `node scripts/generate-interface-doc.js`

## Constructor
`constructor(address _agiTokenAddress, string _baseIpfsUrl, address _ensAddress, address _nameWrapperAddress, bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)`

## Functions
| Signature | State mutability | Returns |
| --- | --- | --- |
| `MAX_REVIEW_PERIOD()` | view | uint256 |
| `MAX_VALIDATORS_PER_JOB()` | view | uint256 |
| `additionalAgentPayoutPercentage()` | view | uint256 |
| `additionalAgents(address)` | view | bool |
| `additionalText1()` | view | string |
| `additionalText2()` | view | string |
| `additionalText3()` | view | string |
| `additionalValidators(address)` | view | bool |
| `addAGIType(address nftAddress, uint256 payoutPercentage)` | nonpayable | — |
| `addAdditionalAgent(address agent)` | nonpayable | — |
| `addAdditionalValidator(address validator)` | nonpayable | — |
| `addModerator(address _moderator)` | nonpayable | — |
| `agiToken()` | view | address |
| `agiTypes(uint256)` | view | address, uint256 |
| `agentMerkleRoot()` | view | bytes32 |
| `agentRootNode()` | view | bytes32 |
| `applyForJob(uint256 _jobId, bytes32[] _proof, string _subdomain)` | nonpayable | — |
| `approve(address to, uint256 tokenId)` | nonpayable | — |
| `balanceOf(address owner)` | view | uint256 |
| `baseIpfsUrl()` | view | string |
| `blacklistAgent(address _agent, bool _status)` | nonpayable | — |
| `blacklistValidator(address _validator, bool _status)` | nonpayable | — |
| `blacklistedAgents(address)` | view | bool |
| `blacklistedValidators(address)` | view | bool |
| `canAccessPremiumFeature(address user)` | view | bool |
| `cancelJob(uint256 _jobId)` | nonpayable | — |
| `clubRootNode()` | view | bytes32 |
| `completionReviewPeriod()` | view | uint256 |
| `contributeToRewardPool(uint256 amount)` | nonpayable | — |
| `disapproveJob(uint256 _jobId, bytes32[] _proof, string _subdomain)` | nonpayable | — |
| `disputeJob(uint256 _jobId)` | nonpayable | — |
| `disputeReviewPeriod()` | view | uint256 |
| `expireJob(uint256 _jobId)` | nonpayable | — |
| `getApproved(uint256 tokenId)` | view | address |
| `getHighestPayoutPercentage(address agent)` | view | uint256 |
| `getJobAgentPayoutPct(uint256 _jobId)` | view | uint256 |
| `getJobStatus(uint256 _jobId)` | view | bool, bool, string |
| `isApprovedForAll(address owner, address operator)` | view | bool |
| `jobDurationLimit()` | view | uint256 |
| `jobStatus(uint256 _jobId)` | view | uint8 |
| `jobStatusString(uint256 _jobId)` | view | string |
| `jobs(uint256)` | view | uint256, address, string, uint256, uint256, address, uint256, bool, bool, uint256, uint256, bool, string, uint256, uint256, bool, uint8, bool |
| `listNFT(uint256 tokenId, uint256 price)` | nonpayable | — |
| `listings(uint256)` | view | uint256, address, uint256, bool |
| `lockedEscrow()` | view | uint256 |
| `maxJobPayout()` | view | uint256 |
| `moderators(address)` | view | bool |
| `nameWrapper()` | view | address |
| `name()` | view | string |
| `nextJobId()` | view | uint256 |
| `nextTokenId()` | view | uint256 |
| `owner()` | view | address |
| `ownerOf(uint256 tokenId)` | view | address |
| `paused()` | view | bool |
| `premiumReputationThreshold()` | view | uint256 |
| `purchaseNFT(uint256 tokenId)` | nonpayable | — |
| `removeAdditionalAgent(address agent)` | nonpayable | — |
| `removeAdditionalValidator(address validator)` | nonpayable | — |
| `removeModerator(address _moderator)` | nonpayable | — |
| `renounceOwnership()` | nonpayable | — |
| `reputation(address)` | view | uint256 |
| `requestJobCompletion(uint256 _jobId)` | nonpayable | — |
| `resolveDispute(uint256 _jobId, string resolution)` | nonpayable | — |
| `resolveStaleDispute(uint256 _jobId)` | nonpayable | — |
| `safeTransferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `safeTransferFrom(address from, address to, uint256 tokenId, bytes data)` | nonpayable | — |
| `setAdditionalAgentPayoutPercentage(uint256 newPercentage)` | nonpayable | — |
| `setApprovalForAll(address operator, bool approved)` | nonpayable | — |
| `setBaseIpfsUrl(string _baseIpfsUrl)` | nonpayable | — |
| `setCompletionReviewPeriod(uint256 newPeriod)` | nonpayable | — |
| `setDisputeReviewPeriod(uint256 newPeriod)` | nonpayable | — |
| `setJobDurationLimit(uint256 _newLimit)` | nonpayable | — |
| `setMaxJobPayout(uint256 _newMax)` | nonpayable | — |
| `setPremiumReputationThreshold(uint256 _threshold)` | nonpayable | — |
| `setRequiredValidatorApprovals(uint256 _required)` | nonpayable | — |
| `setRequiredValidatorDisapprovals(uint256 _required)` | nonpayable | — |
| `setValidationRewardPercentage(uint256 _percentage)` | nonpayable | — |
| `supportsInterface(bytes4 interfaceId)` | view | bool |
| `symbol()` | view | string |
| `termsAndConditionsIpfsHash()` | view | string |
| `tokenURI(uint256 tokenId)` | view | string |
| `totalSupply()` | view | uint256 |
| `transferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `transferOwnership(address newOwner)` | nonpayable | — |
| `updateAdditionalText1(string _text)` | nonpayable | — |
| `updateAdditionalText2(string _text)` | nonpayable | — |
| `updateAdditionalText3(string _text)` | nonpayable | — |
| `updateAGITokenAddress(address _newTokenAddress)` | nonpayable | — |
| `updateContactEmail(string _email)` | nonpayable | — |
| `updateTermsAndConditionsIpfsHash(string _hash)` | nonpayable | — |
| `validateJob(uint256 _jobId, bytes32[] _proof, string _subdomain)` | nonpayable | — |
| `validatorApprovedJobs(address, uint256)` | view | uint256 |
| `validatorMerkleRoot()` | view | bytes32 |
| `withdrawableAGI()` | view | uint256 |
| `withdrawAGI(uint256 amount)` | nonpayable | — |

## Events
| Event | Indexed fields |
| --- | --- |
| `AGITypeUpdated(address nftAddress, uint256 payoutPercentage)` | indexed address nftAddress |
| `AGIWithdrawn(address to, uint256 amount, uint256 remainingWithdrawable)` | indexed address to |
| `AdditionalAgentPayoutPercentageUpdated(uint256 newPercentage)` | — |
| `Approval(address owner, address approved, uint256 tokenId)` | indexed address owner, indexed address approved, indexed uint256 tokenId |
| `ApprovalForAll(address owner, address operator, bool approved)` | indexed address owner, indexed address operator |
| `CompletionReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | — |
| `DisputeResolved(uint256 jobId, address resolver, string resolution)` | — |
| `DisputeReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | — |
| `DisputeTimeoutResolved(uint256 jobId, address resolver, bool employerWins)` | — |
| `JobApplied(uint256 jobId, address agent)` | — |
| `JobCancelled(uint256 jobId)` | — |
| `JobCompleted(uint256 jobId, address agent, uint256 reputationPoints)` | — |
| `JobCreated(uint256 jobId, string ipfsHash, uint256 payout, uint256 duration, string details)` | — |
| `JobDisapproved(uint256 jobId, address validator)` | — |
| `JobDisputed(uint256 jobId, address disputant)` | — |
| `JobExpired(uint256 jobId, address employer, address agent, uint256 payout)` | — |
| `JobFinalized(uint256 jobId, address agent, address employer, bool agentPaid, uint256 payout)` | — |
| `JobValidated(uint256 jobId, address validator)` | — |
| `JobCompletionRequested(uint256 jobId, address agent)` | — |
| `MerkleRootUpdated(bytes32 newMerkleRoot)` | indexed bytes32 newMerkleRoot |
| `NFTDelisted(uint256 tokenId)` | — |
| `NFTIssued(uint256 tokenId, address employer, string tokenURI)` | indexed uint256 tokenId, indexed address employer |
| `NFTListed(uint256 tokenId, address seller, uint256 price)` | indexed uint256 tokenId, indexed address seller |
| `NFTPurchased(uint256 tokenId, address buyer, uint256 price)` | indexed uint256 tokenId, indexed address buyer |
| `OwnershipTransferred(address previousOwner, address newOwner)` | indexed address previousOwner, indexed address newOwner |
| `OwnershipVerified(address claimant, string subdomain)` | — |
| `RecoveryInitiated(string reason)` | — |
| `ReputationUpdated(address user, uint256 newReputation)` | — |
| `RewardPoolContribution(address contributor, uint256 amount)` | indexed address contributor |
| `RootNodeUpdated(bytes32 newRootNode)` | indexed bytes32 newRootNode |
| `Transfer(address from, address to, uint256 tokenId)` | indexed address from, indexed address to, indexed uint256 tokenId |
| `Unpaused(address account)` | indexed address account |
| `Paused(address account)` | indexed address account |

## Custom errors
| Error | Inputs |
| --- | --- |
| `Blacklisted()` | — |
| `IneligibleAgentPayout()` | — |
| `InsolventEscrowBalance()` | — |
| `InsufficientWithdrawableBalance()` | — |
| `InvalidAgentPayoutSnapshot()` | — |
| `InvalidParameters()` | — |
| `InvalidState()` | — |
| `InvalidValidatorThresholds()` | — |
| `JobNotFound()` | — |
| `NotAuthorized()` | — |
| `NotModerator()` | — |
| `TransferFailed()` | — |
| `ValidatorLimitReached()` | — |
| `ValidatorSetTooLarge()` | — |
