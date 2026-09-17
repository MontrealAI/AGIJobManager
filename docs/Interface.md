# AGIJobManager interface reference

> Generated from `build/contracts/AGIJobManager.json`. Regenerate with:
>
> `node scripts/generate-interface-doc.js`

## Constructor
`constructor(address usdcTokenAddress, string baseIpfs, address[2] ensConfig, bytes32[4] rootNodes, bytes32[2] merkleRoots, address[2] settlementWallets)`

## Functions
| Signature | State mutability | Returns |
| --- | --- | --- |
| `MAX_AGI_TYPES()` | view | uint256 |
| `MAX_VALIDATORS_PER_JOB()` | view | uint256 |
| `acceptOwnership()` | nonpayable | — |
| `additionalAgents(address)` | view | bool |
| `additionalValidators(address)` | view | bool |
| `agentBond()` | view | uint256 |
| `agentBondBps()` | view | uint256 |
| `agentBondMax()` | view | uint256 |
| `agentMerkleRoot()` | view | bytes32 |
| `agentRootNode()` | view | bytes32 |
| `agiTypes(uint256)` | view | address, uint256 |
| `alphaAgentRootNode()` | view | bytes32 |
| `alphaClubRootNode()` | view | bytes32 |
| `approve(address to, uint256 tokenId)` | nonpayable | — |
| `balanceOf(address owner)` | view | uint256 |
| `blacklistedAgents(address)` | view | bool |
| `blacklistedValidators(address)` | view | bool |
| `challengePeriodAfterApproval()` | view | uint256 |
| `clubRootNode()` | view | bytes32 |
| `completionReviewPeriod()` | view | uint256 |
| `disputeReviewPeriod()` | view | uint256 |
| `ens()` | view | address |
| `ensJobPages()` | view | address |
| `getApproved(uint256 tokenId)` | view | address |
| `isApprovedForAll(address owner, address operator)` | view | bool |
| `jobDurationLimit()` | view | uint256 |
| `lockIdentityConfig()` | view | bool |
| `lockedAgentBonds()` | view | uint256 |
| `lockedDisputeBonds()` | view | uint256 |
| `lockedEscrow()` | view | uint256 |
| `lockedValidatorBonds()` | view | uint256 |
| `maxActiveJobsPerAgent()` | view | uint256 |
| `maxJobPayout()` | view | uint256 |
| `moderators(address)` | view | bool |
| `name()` | view | string |
| `nameWrapper()` | view | address |
| `nextJobId()` | view | uint256 |
| `nextTokenId()` | view | uint256 |
| `owner()` | view | address |
| `ownerOf(uint256 tokenId)` | view | address |
| `paused()` | view | bool |
| `pendingOwner()` | view | address |
| `premiumReputationThreshold()` | view | uint256 |
| `reputation(address)` | view | uint256 |
| `requiredValidatorApprovals()` | view | uint256 |
| `requiredValidatorDisapprovals()` | view | uint256 |
| `safeTransferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `safeTransferFrom(address from, address to, uint256 tokenId, bytes data)` | nonpayable | — |
| `setApprovalForAll(address operator, bool approved)` | nonpayable | — |
| `settlementPaused()` | view | bool |
| `supportsInterface(bytes4 interfaceId)` | view | bool |
| `symbol()` | view | string |
| `transferFrom(address from, address to, uint256 tokenId)` | nonpayable | — |
| `transferOwnership(address newOwner)` | nonpayable | — |
| `usdcToken()` | view | address |
| `validationRewardPercentage()` | view | uint256 |
| `validatorBondBps()` | view | uint256 |
| `validatorBondMax()` | view | uint256 |
| `validatorBondMin()` | view | uint256 |
| `validatorMerkleRoot()` | view | bytes32 |
| `validatorSlashBps()` | view | uint256 |
| `voteQuorum()` | view | uint256 |
| `wallet10()` | view | address |
| `wallet30()` | view | address |
| `setSettlementWallets(address recipient30, address recipient10)` | nonpayable | — |
| `renounceOwnership()` | pure | — |
| `pause()` | nonpayable | — |
| `unpause()` | nonpayable | — |
| `pauseIntake()` | nonpayable | — |
| `unpauseIntake()` | nonpayable | — |
| `pauseAll()` | nonpayable | — |
| `unpauseAll()` | nonpayable | — |
| `setSettlementPaused(bool paused)` | nonpayable | — |
| `lockIdentityConfiguration()` | nonpayable | — |
| `createJob(string _jobSpecURI, uint256 _payout, uint256 _duration, string _details)` | nonpayable | — |
| `applyForJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `requestJobCompletion(uint256 _jobId, string _jobCompletionURI)` | nonpayable | — |
| `validateJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `disapproveJob(uint256 _jobId, string subdomain, bytes32[] proof)` | nonpayable | — |
| `disputeJob(uint256 _jobId)` | nonpayable | — |
| `resolveDisputeWithCode(uint256 _jobId, uint8 resolutionCode, string reason)` | nonpayable | — |
| `resolveStaleDispute(uint256 _jobId, bool employerWins)` | nonpayable | — |
| `blacklistAgent(address _agent, bool _status)` | nonpayable | — |
| `blacklistValidator(address _validator, bool _status)` | nonpayable | — |
| `delistJob(uint256 _jobId)` | nonpayable | — |
| `addModerator(address _moderator)` | nonpayable | — |
| `removeModerator(address _moderator)` | nonpayable | — |
| `updateEnsRegistry(address _newEnsRegistry)` | nonpayable | — |
| `updateNameWrapper(address _newNameWrapper)` | nonpayable | — |
| `setEnsJobPages(address _ensJobPages)` | nonpayable | — |
| `setUseEnsJobTokenURI(bool enabled)` | nonpayable | — |
| `updateRootNodes(bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _alphaClubRootNode, bytes32 _alphaAgentRootNode)` | nonpayable | — |
| `updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` | nonpayable | — |
| `setBaseIpfsUrl(string _url)` | nonpayable | — |
| `setRequiredValidatorApprovals(uint256 _approvals)` | nonpayable | — |
| `setRequiredValidatorDisapprovals(uint256 _disapprovals)` | nonpayable | — |
| `setPremiumReputationThreshold(uint256 _threshold)` | nonpayable | — |
| `setVoteQuorum(uint256 _quorum)` | nonpayable | — |
| `setMaxJobPayout(uint256 _maxPayout)` | nonpayable | — |
| `setJobDurationLimit(uint256 _limit)` | nonpayable | — |
| `setMaxActiveJobsPerAgent(uint256 value)` | nonpayable | — |
| `setCompletionReviewPeriod(uint256 _period)` | nonpayable | — |
| `setDisputeReviewPeriod(uint256 _period)` | nonpayable | — |
| `setValidatorBondParams(uint256 bps, uint256 min, uint256 max)` | nonpayable | — |
| `setAgentBondParams(uint256 bps, uint256 min, uint256 max)` | nonpayable | — |
| `setAgentBond(uint256 bond)` | nonpayable | — |
| `setValidatorSlashBps(uint256 bps)` | nonpayable | — |
| `setChallengePeriodAfterApproval(uint256 period)` | nonpayable | — |
| `getJobCore(uint256 jobId)` | view | address, address, uint256, uint256, uint256, bool, bool, bool, uint8 |
| `getJobValidation(uint256 jobId)` | view | bool, uint256, uint256, uint256, uint256 |
| `getJobSpecURI(uint256 jobId)` | view | string |
| `getJobCompletionURI(uint256 jobId)` | view | string |
| `setValidationRewardPercentage(uint256 _percentage)` | nonpayable | — |
| `cancelJob(uint256 _jobId)` | nonpayable | — |
| `expireJob(uint256 _jobId)` | nonpayable | — |
| `lockJobENS(uint256 jobId, bool burnFuses)` | nonpayable | — |
| `finalizeJob(uint256 _jobId)` | nonpayable | — |
| `safeMintCompletionNFT(address to, uint256 tokenId)` | nonpayable | — |
| `tokenURI(uint256 tokenId)` | view | string |
| `addAdditionalValidator(address validator)` | nonpayable | — |
| `removeAdditionalValidator(address validator)` | nonpayable | — |
| `addAdditionalAgent(address agent)` | nonpayable | — |
| `removeAdditionalAgent(address agent)` | nonpayable | — |
| `withdrawableUSDC()` | view | uint256 |
| `withdrawUSDC(uint256 amount)` | nonpayable | — |
| `rescueETH(uint256 amount)` | nonpayable | — |
| `rescueERC20(address token, address to, uint256 amount)` | nonpayable | — |
| `rescueToken(address token, bytes data)` | nonpayable | — |
| `addAGIType(address nftAddress, uint256 payoutPercentage)` | nonpayable | — |
| `disableAGIType(address nftAddress)` | nonpayable | — |
| `getHighestPayoutPercentage(address agent)` | view | uint256 |

## Events
| Event | Indexed fields |
| --- | --- |
| `AGITypeUpdated(address nftAddress, uint256 payoutPercentage)` | indexed address nftAddress, indexed uint256 payoutPercentage |
| `AgentBlacklisted(address agent, bool status)` | indexed address agent, indexed bool status |
| `AgentBondMinUpdated(uint256 oldMin, uint256 newMin)` | indexed uint256 oldMin, indexed uint256 newMin |
| `AgentBondParamsUpdated(uint256 oldBps, uint256 oldMin, uint256 oldMax, uint256 newBps, uint256 newMin, uint256 newMax)` | indexed uint256 oldBps, indexed uint256 oldMin, indexed uint256 oldMax, uint256 newBps, uint256 newMin, uint256 newMax |
| `Approval(address owner, address approved, uint256 tokenId)` | indexed address owner, indexed address approved, indexed uint256 tokenId |
| `ApprovalForAll(address owner, address operator, bool approved)` | indexed address owner, indexed address operator, bool approved |
| `ChallengePeriodAfterApprovalUpdated(uint256 oldPeriod, uint256 newPeriod)` | indexed uint256 oldPeriod, indexed uint256 newPeriod |
| `CompletionReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | indexed uint256 oldPeriod, indexed uint256 newPeriod |
| `DisputeResolvedWithCode(uint256 jobId, address resolver, uint8 resolutionCode, string reason)` | indexed uint256 jobId, indexed address resolver, indexed uint8 resolutionCode, string reason |
| `DisputeReviewPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)` | indexed uint256 oldPeriod, indexed uint256 newPeriod |
| `EnsHookAttempted(uint8 hook, uint256 jobId, address target, bool success)` | indexed uint8 hook, indexed uint256 jobId, indexed address target, bool success |
| `EnsJobPagesUpdated(address oldEnsJobPages, address newEnsJobPages)` | indexed address oldEnsJobPages, indexed address newEnsJobPages |
| `EnsRegistryUpdated(address newEnsRegistry)` | address newEnsRegistry |
| `IdentityConfigurationLocked(address locker, uint256 atTimestamp)` | indexed address locker, indexed uint256 atTimestamp |
| `JobApplied(uint256 jobId, address agent)` | indexed uint256 jobId, indexed address agent |
| `JobCancelled(uint256 jobId)` | indexed uint256 jobId |
| `JobCompleted(uint256 jobId, address agent, uint256 reputationPoints)` | indexed uint256 jobId, indexed address agent, indexed uint256 reputationPoints |
| `JobCompletionRequested(uint256 jobId, address agent, string jobCompletionURI)` | indexed uint256 jobId, indexed address agent, string jobCompletionURI |
| `JobCreated(uint256 jobId, string jobSpecURI, uint256 payout, uint256 duration, string details)` | indexed uint256 jobId, string jobSpecURI, indexed uint256 payout, indexed uint256 duration, string details |
| `JobDisapproved(uint256 jobId, address validator)` | indexed uint256 jobId, indexed address validator |
| `JobDisputed(uint256 jobId, address disputant)` | indexed uint256 jobId, indexed address disputant |
| `JobExpired(uint256 jobId, address employer, address agent, uint256 payout)` | indexed uint256 jobId, indexed address employer, address agent, indexed uint256 payout |
| `JobPayoutDistributed(uint256 jobId, uint256 validatorBudget, uint256 wallet30Amount, uint256 wallet10Amount, uint256 agentAmount)` | indexed uint256 jobId, uint256 validatorBudget, uint256 wallet30Amount, uint256 wallet10Amount, uint256 agentAmount |
| `JobValidated(uint256 jobId, address validator)` | indexed uint256 jobId, indexed address validator |
| `MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot)` | bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot |
| `NFTIssued(uint256 tokenId, address employer, string tokenURI)` | indexed uint256 tokenId, indexed address employer, string tokenURI |
| `NameWrapperUpdated(address newNameWrapper)` | address newNameWrapper |
| `OwnershipTransferStarted(address previousOwner, address newOwner)` | indexed address previousOwner, indexed address newOwner |
| `OwnershipTransferred(address previousOwner, address newOwner)` | indexed address previousOwner, indexed address newOwner |
| `Paused(address account)` | address account |
| `ReputationUpdated(address user, uint256 newReputation)` | address user, uint256 newReputation |
| `RequiredValidatorApprovalsUpdated(uint256 oldApprovals, uint256 newApprovals)` | indexed uint256 oldApprovals, indexed uint256 newApprovals |
| `RequiredValidatorDisapprovalsUpdated(uint256 oldDisapprovals, uint256 newDisapprovals)` | indexed uint256 oldDisapprovals, indexed uint256 newDisapprovals |
| `RootNodesUpdated(bytes32 clubRootNode, bytes32 agentRootNode, bytes32 alphaClubRootNode, bytes32 alphaAgentRootNode)` | indexed bytes32 clubRootNode, indexed bytes32 agentRootNode, indexed bytes32 alphaClubRootNode, bytes32 alphaAgentRootNode |
| `SettlementPauseSet(address setter, bool paused)` | indexed address setter, indexed bool paused |
| `SettlementWalletsUpdated(address wallet30, address wallet10)` | indexed address wallet30, indexed address wallet10 |
| `Transfer(address from, address to, uint256 tokenId)` | indexed address from, indexed address to, indexed uint256 tokenId |
| `USDCWithdrawn(address to, uint256 amount, uint256 remainingWithdrawable)` | indexed address to, indexed uint256 amount, uint256 remainingWithdrawable |
| `Unpaused(address account)` | address account |
| `ValidationRewardPercentageUpdated(uint256 oldPercentage, uint256 newPercentage)` | indexed uint256 oldPercentage, indexed uint256 newPercentage |
| `ValidatorBlacklisted(address validator, bool status)` | indexed address validator, indexed bool status |
| `ValidatorBondParamsUpdated(uint256 bps, uint256 min, uint256 max)` | indexed uint256 bps, indexed uint256 min, indexed uint256 max |
| `ValidatorSlashBpsUpdated(uint256 oldBps, uint256 newBps)` | indexed uint256 oldBps, indexed uint256 newBps |
| `VoteQuorumUpdated(uint256 oldQuorum, uint256 newQuorum)` | indexed uint256 oldQuorum, indexed uint256 newQuorum |

## Custom errors
| Error | Inputs |
| --- | --- |
| `Blacklisted()` | — |
| `ConfigLocked()` | — |
| `IneligibleAgentPayout()` | — |
| `InsolventEscrowBalance()` | — |
| `InsufficientWithdrawableBalance()` | — |
| `InvalidParameters()` | — |
| `InvalidState()` | — |
| `InvalidValidatorThresholds()` | — |
| `JobNotFound()` | — |
| `NotAuthorized()` | — |
| `NotModerator()` | — |
| `SettlementPaused()` | — |
| `TransferFailed()` | — |
| `ValidatorLimitReached()` | — |
