# AGIJobManager interface reference

> Generated from `build/contracts/AGIJobManager.json`. Regenerate with:
>
> `node scripts/generate-interface-doc.js`

## Constructor
`constructor(address _agiTokenAddress, string _baseIpfsUrl, address _ensAddress, address _nameWrapperAddress, bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)`

## Functions
| Signature | State mutability | Returns |
| --- | --- | --- |
| `MAX_VALIDATORS_PER_JOB()` | view | uint256 |
| `additionalAgentPayoutPercentage()` | view | uint256 |
| `additionalAgents(address)` | view | bool |
| `additionalText1()` | view | string |
| `additionalText2()` | view | string |
| `additionalText3()` | view | string |
| `additionalValidators(address)` | view | bool |
| `agentMerkleRoot()` | view | bytes32 |
| `agentRootNode()` | view | bytes32 |
| `agiToken()` | view | address |
| `agiTypes(uint256)` | view | address, uint256 |
| `approve(address to, uint256 tokenId)` | nonpayable | — |
| `balanceOf(address owner)` | view | uint256 |
| `blacklistedAgents(address)` | view | bool |
| `blacklistedValidators(address)` | view | bool |
| `clubRootNode()` | view | bytes32 |
| `completionReviewPeriod()` | view | uint256 |
| `contactEmail()` | view | string |
| `disputeReviewPeriod()` | view | uint256 |
| `ens()` | view | address |
| `getApproved(uint256 tokenId)` | view | address |
| `isApprovedForAll(address owner, address operator)` | view | bool |
| `jobDurationLimit()` | view | uint256 |
| `getJobCore(uint256)` | view | address, address, uint256, uint256, uint256, bool, bool, bool, uint8 |
| `getJobValidation(uint256)` | view | bool, uint256, uint256, uint256, uint256 |
| `getJobURIs(uint256)` | view | string, string, string, string |
| `listings(uint256)` | view | uint256, address, uint256, bool |
| `lockedEscrow()` | view | uint256 |
| `maxJobPayout()` | view | uint256 |
| `moderators(address)` | view | bool |
| `name()` | view | string |
| `nameWrapper()` | view | address |
| `nextJobId()` | view | uint256 |
| `nextTokenId()` | view | uint256 |
| `owner()` | view | address |
| `ownerOf(uint256 tokenId)` | view | address |
| `paused()` | view | bool |
| `premiumReputationThreshold()` | view | uint256 |
| `renounceOwnership()` | nonpayable | — |
| `reputation(address)` | view | uint256 |
| `requiredValidatorApprovals()` | view | uint256 |
| `requiredValidatorDisapprovals()` | view | uint256 |
| `safeTransferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `safeTransferFrom(address from, address to, uint256 tokenId, bytes data)` | nonpayable | — |
| `setApprovalForAll(address operator, bool approved)` | nonpayable | — |
| `supportsInterface(bytes4 interfaceId)` | view | bool |
| `symbol()` | view | string |
| `termsAndConditionsIpfsHash()` | view | string |
| `tokenURI(uint256 tokenId)` | view | string |
| `transferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `transferOwnership(address newOwner)` | nonpayable | — |
| `validationRewardPercentage()` | view | uint256 |
| `validatorApprovedJobs(address, uint256)` | view | uint256 |
| `validatorMerkleRoot()` | view | bytes32 |
| `pause()` | nonpayable | — |
| `unpause()` | nonpayable | — |
| `createJob(string _jobSpecURI, uint256 _payout, uint256 _duration, string _details)` | nonpayable | — |
| `applyForJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `requestJobCompletion(uint256 _jobId, string _jobCompletionURI)` | nonpayable | — |
| `validateJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `disapproveJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `disputeJob(uint256 _jobId)` | nonpayable | — |
| `resolveDispute(uint256 _jobId, string resolution)` | nonpayable | — |
| `resolveDisputeWithCode(uint256 _jobId, uint8 resolutionCode, string reason)` | nonpayable | — |
| `resolveStaleDispute(uint256 _jobId, bool employerWins)` | nonpayable | — |
| `blacklistAgent(address _agent, bool _status)` | nonpayable | — |
| `blacklistValidator(address _validator, bool _status)` | nonpayable | — |
| `delistJob(uint256 _jobId)` | nonpayable | — |
| `addModerator(address _moderator)` | nonpayable | — |
| `removeModerator(address _moderator)` | nonpayable | — |
| `updateAGITokenAddress(address _newTokenAddress)` | nonpayable | — |
| `setBaseIpfsUrl(string _url)` | nonpayable | — |
| `setRequiredValidatorApprovals(uint256 _approvals)` | nonpayable | — |
| `setRequiredValidatorDisapprovals(uint256 _disapprovals)` | nonpayable | — |
| `setPremiumReputationThreshold(uint256 _threshold)` | nonpayable | — |
| `setMaxJobPayout(uint256 _maxPayout)` | nonpayable | — |
| `setJobDurationLimit(uint256 _limit)` | nonpayable | — |
| `setCompletionReviewPeriod(uint256 _period)` | nonpayable | — |
| `setDisputeReviewPeriod(uint256 _period)` | nonpayable | — |
| `updateTermsAndContact(string _hash, string _email)` | nonpayable | — |
| `updateAdditionalTexts(string _text1, string _text2, string _text3)` | nonpayable | — |
| `setValidationRewardPercentage(uint256 _percentage)` | nonpayable | — |
| `cancelJob(uint256 _jobId)` | nonpayable | — |
| `expireJob(uint256 _jobId)` | nonpayable | — |
| `finalizeJob(uint256 _jobId)` | nonpayable | — |
| `listNFT(uint256 tokenId, uint256 price)` | nonpayable | — |
| `purchaseNFT(uint256 tokenId)` | nonpayable | — |
| `delistNFT(uint256 tokenId)` | nonpayable | — |
| `addAdditionalValidator(address validator)` | nonpayable | — |
| `removeAdditionalValidator(address validator)` | nonpayable | — |
| `addAdditionalAgent(address agent)` | nonpayable | — |
| `removeAdditionalAgent(address agent)` | nonpayable | — |
| `withdrawableAGI()` | view | uint256 |
| `withdrawAGI(uint256 amount)` | nonpayable | — |
| `canAccessPremiumFeature(address user)` | view | bool |
| `contributeToRewardPool(uint256 amount)` | nonpayable | — |
| `addAGIType(address nftAddress, uint256 payoutPercentage)` | nonpayable | — |
| `getHighestPayoutPercentage(address agent)` | view | uint256 |

## Events
| Event | Indexed fields |
| --- | --- |
| `AGITypeUpdated(address nftAddress, uint256 payoutPercentage)` | indexed address nftAddress, uint256 payoutPercentage |
| `AGIWithdrawn(address to, uint256 amount, uint256 remainingWithdrawable)` | indexed address to, uint256 amount, uint256 remainingWithdrawable |
| `AdditionalAgentPayoutPercentageUpdated(uint256 newPercentage)` | uint256 newPercentage |
| `Approval(address owner, address approved, uint256 tokenId)` | indexed address owner, indexed address approved, indexed uint256 tokenId |
| `ApprovalForAll(address owner, address operator, bool approved)` | indexed address owner, indexed address operator, bool approved |
| `BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId)` | uint256 _fromTokenId, uint256 _toTokenId |
| `CompletionReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | uint256 oldPeriod, uint256 newPeriod |
| `DisputeResolved(uint256 jobId, address resolver, string resolution)` | uint256 jobId, address resolver, string resolution |
| `DisputeResolvedWithCode(uint256 jobId, address resolver, uint8 resolutionCode, string reason)` | uint256 jobId, address resolver, uint8 resolutionCode, string reason |
| `DisputeReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | uint256 oldPeriod, uint256 newPeriod |
| `DisputeTimeoutResolved(uint256 jobId, address resolver, bool employerWins)` | uint256 jobId, address resolver, bool employerWins |
| `JobApplied(uint256 jobId, address agent)` | uint256 jobId, address agent |
| `JobCancelled(uint256 jobId)` | uint256 jobId |
| `JobCompleted(uint256 jobId, address agent, uint256 reputationPoints)` | uint256 jobId, address agent, uint256 reputationPoints |
| `JobCompletionRequested(uint256 jobId, address agent, string jobCompletionURI)` | uint256 jobId, address agent, string jobCompletionURI |
| `JobCreated(uint256 jobId, string jobSpecURI, uint256 payout, uint256 duration, string details)` | uint256 jobId, string jobSpecURI, uint256 payout, uint256 duration, string details |
| `JobDisapproved(uint256 jobId, address validator)` | uint256 jobId, address validator |
| `JobDisputed(uint256 jobId, address disputant)` | uint256 jobId, address disputant |
| `JobExpired(uint256 jobId, address employer, address agent, uint256 payout)` | uint256 jobId, address employer, address agent, uint256 payout |
| `JobFinalized(uint256 jobId, address agent, address employer, bool agentPaid, uint256 payout)` | uint256 jobId, address agent, address employer, bool agentPaid, uint256 payout |
| `JobValidated(uint256 jobId, address validator)` | uint256 jobId, address validator |
| `MerkleRootUpdated(bytes32 newMerkleRoot)` | indexed bytes32 newMerkleRoot |
| `MetadataUpdate(uint256 _tokenId)` | uint256 _tokenId |
| `NFTDelisted(uint256 tokenId)` | indexed uint256 tokenId |
| `NFTIssued(uint256 tokenId, address employer, string tokenURI)` | indexed uint256 tokenId, indexed address employer, string tokenURI |
| `NFTListed(uint256 tokenId, address seller, uint256 price)` | indexed uint256 tokenId, indexed address seller, uint256 price |
| `NFTPurchased(uint256 tokenId, address buyer, uint256 price)` | indexed uint256 tokenId, indexed address buyer, uint256 price |
| `OwnershipTransferred(address previousOwner, address newOwner)` | indexed address previousOwner, indexed address newOwner |
| `OwnershipVerified(address claimant, string subdomain)` | address claimant, string subdomain |
| `Paused(address account)` | address account |
| `RecoveryInitiated(string reason)` | string reason |
| `ReputationUpdated(address user, uint256 newReputation)` | address user, uint256 newReputation |
| `RewardPoolContribution(address contributor, uint256 amount)` | indexed address contributor, uint256 amount |
| `RootNodeUpdated(bytes32 newRootNode)` | indexed bytes32 newRootNode |
| `Transfer(address from, address to, uint256 tokenId)` | indexed address from, indexed address to, indexed uint256 tokenId |
| `Unpaused(address account)` | address account |

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
