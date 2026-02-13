# AGIJobManager Contract Interface (Generated)

Verified against repository state: `79d6495`.

Generated at: `2026-02-13T14:45:51-05:00`.

## Operator-facing interface

- `addAGIType(address nftAddress, uint256 payoutPercentage) external onlyOwner`
- `addAdditionalAgent(address agent) external onlyOwner`
- `addAdditionalValidator(address validator) external onlyOwner`
- `addModerator(address _moderator) external onlyOwner`
- `applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenNotPaused whenSettlementNotPaused nonReentrant`
- `blacklistAgent(address _agent, bool _status) external onlyOwner`
- `blacklistValidator(address _validator, bool _status) external onlyOwner`
- `cancelJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant`
- `createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details) external whenNotPaused whenSettlementNotPaused nonReentrant`
- `delistJob(uint256 _jobId) external onlyOwner whenSettlementNotPaused nonReentrant`
- `disableAGIType(address nftAddress) external onlyOwner`
- `disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenSettlementNotPaused nonReentrant`
- `disputeJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant`
- `expireJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant`
- `finalizeJob(uint256 _jobId) external whenSettlementNotPaused nonReentrant`
- `getHighestPayoutPercentage(address agent) public view returns (uint256)`
- `getJobCompletionURI(uint256 jobId) external view returns (string memory)`
- `getJobCore(uint256 jobId) external view returns ( address employer, address assignedAgent, uint256 payout, uint256 duration, uint256 assignedAt, bool completed, bool disputed, bool expired, uint8 agentPayoutPct )`
- `getJobSpecURI(uint256 jobId) external view returns (string memory)`
- `getJobValidation(uint256 jobId) external view returns ( bool completionRequested, uint256 validatorApprovals, uint256 validatorDisapprovals, uint256 completionRequestedAt, uint256 disputedAt )`
- `lockIdentityConfiguration() external onlyOwner whenIdentityConfigurable`
- `lockJobENS(uint256 jobId, bool burnFuses) external`
- `ownerOf(uint256 id) external view returns (address)`
- `pause() external onlyOwner`
- `removeAdditionalAgent(address agent) external onlyOwner`
- `removeAdditionalValidator(address validator) external onlyOwner`
- `removeModerator(address _moderator) external onlyOwner`
- `requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI) external whenSettlementNotPaused nonReentrant`
- `rescueERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant`
- `rescueETH(uint256 amount) external onlyOwner nonReentrant`
- `rescueToken(address token, bytes calldata data) external onlyOwner nonReentrant`
- `resolveDisputeWithCode( uint256 _jobId, uint8 resolutionCode, string calldata reason ) external onlyModerator whenSettlementNotPaused nonReentrant`
- `resolveStaleDispute(uint256 _jobId, bool employerWins) external onlyOwner whenSettlementNotPaused nonReentrant`
- `resolver(bytes32 node) external view returns (address)`
- `safeMintCompletionNFT(address to, uint256 tokenId) external`
- `setAgentBond(uint256 bond) external onlyOwner`
- `setAgentBondParams(uint256 bps, uint256 min, uint256 max) external onlyOwner`
- `setBaseIpfsUrl(string calldata _url) external onlyOwner`
- `setChallengePeriodAfterApproval(uint256 period) external onlyOwner`
- `setCompletionReviewPeriod(uint256 _period) external onlyOwner`
- `setDisputeReviewPeriod(uint256 _period) external onlyOwner`
- `setEnsJobPages(address _ensJobPages) external onlyOwner whenIdentityConfigurable`
- `setJobDurationLimit(uint256 _limit) external onlyOwner`
- `setMaxJobPayout(uint256 _maxPayout) external onlyOwner`
- `setPremiumReputationThreshold(uint256 _threshold) external onlyOwner`
- `setRequiredValidatorApprovals(uint256 _approvals) external onlyOwner`
- `setRequiredValidatorDisapprovals(uint256 _disapprovals) external onlyOwner`
- `setSettlementPaused(bool paused) external onlyOwner`
- `setUseEnsJobTokenURI(bool enabled) external onlyOwner`
- `setValidationRewardPercentage(uint256 _percentage) external onlyOwner`
- `setValidatorBondParams(uint256 bps, uint256 min, uint256 max) external onlyOwner`
- `setValidatorSlashBps(uint256 bps) external onlyOwner`
- `setVoteQuorum(uint256 _quorum) external onlyOwner`
- `tokenURI(uint256 tokenId) public view override returns (string memory)`
- `unpause() external onlyOwner`
- `updateAGITokenAddress(address _newTokenAddress) external onlyOwner whenIdentityConfigurable`
- `updateEnsRegistry(address _newEnsRegistry) external onlyOwner whenIdentityConfigurable`
- `updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot) external onlyOwner`
- `updateNameWrapper(address _newNameWrapper) external onlyOwner whenIdentityConfigurable`
- `updateRootNodes( bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _alphaClubRootNode, bytes32 _alphaAgentRootNode ) external onlyOwner whenIdentityConfigurable`
- `validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof) external whenSettlementNotPaused nonReentrant`
- `withdrawAGI(uint256 amount) external onlyOwner whenSettlementNotPaused whenPaused nonReentrant`
- `withdrawableAGI() public view returns (uint256)`

## Public state variables (operator-relevant)

- `additionalAgents`
- `additionalValidators`
- `agentBond = 1e18`
- `agentBondBps = 500`
- `agentBondMax = 88888888e18`
- `agentMerkleRoot`
- `agentRootNode`
- `agiToken`
- `alphaAgentRootNode`
- `alphaClubRootNode`
- `blacklistedAgents`
- `blacklistedValidators`
- `challengePeriodAfterApproval = 1 days`
- `clubRootNode`
- `completionReviewPeriod = 7 days`
- `constant MAX_AGI_TYPES = 32`
- `constant MAX_VALIDATORS_PER_JOB = 50`
- `disputeReviewPeriod = 14 days`
- `ensJobPages`
- `jobDurationLimit = 10000000`
- `lockIdentityConfig`
- `lockedAgentBonds`
- `lockedDisputeBonds`
- `lockedEscrow`
- `lockedValidatorBonds`
- `maxJobPayout = 88888888e18`
- `moderators`
- `nextJobId`
- `nextTokenId`
- `premiumReputationThreshold = 10000`
- `reputation`
- `requiredValidatorApprovals = 3`
- `requiredValidatorDisapprovals = 3`
- `settlementPaused`
- `validationRewardPercentage = 8`
- `validatorBondBps = 1500`
- `validatorBondMax = 88888888e18`
- `validatorBondMin = 10e18`
- `validatorMerkleRoot`
- `validatorSlashBps = 8000`
- `voteQuorum = 3`

## Events index

- `AGITokenAddressUpdated(address indexed oldToken, address indexed newToken)`
- `AGITypeUpdated(address indexed nftAddress, uint256 indexed payoutPercentage)`
- `AGIWithdrawn(address indexed to, uint256 indexed amount, uint256 remainingWithdrawable)`
- `AgentBlacklisted(address indexed agent, bool indexed status)`
- `AgentBondMinUpdated(uint256 indexed oldMin, uint256 indexed newMin)`
- `AgentBondParamsUpdated( uint256 indexed oldBps, uint256 indexed oldMin, uint256 indexed oldMax, uint256 newBps, uint256 newMin, uint256 newMax )`
- `ChallengePeriodAfterApprovalUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod)`
- `CompletionReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod)`
- `DisputeResolvedWithCode( uint256 indexed jobId, address indexed resolver, uint8 indexed resolutionCode, string reason )`
- `DisputeReviewPeriodUpdated(uint256 indexed oldPeriod, uint256 indexed newPeriod)`
- `EnsHookAttempted(uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success)`
- `EnsJobPagesUpdated(address indexed oldEnsJobPages, address indexed newEnsJobPages)`
- `EnsRegistryUpdated(address newEnsRegistry)`
- `IdentityConfigurationLocked(address indexed locker, uint256 indexed atTimestamp)`
- `JobApplied(uint256 indexed jobId, address indexed agent)`
- `JobCancelled(uint256 indexed jobId)`
- `JobCompleted(uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints)`
- `JobCompletionRequested(uint256 indexed jobId, address indexed agent, string jobCompletionURI)`
- `JobCreated( uint256 indexed jobId, string jobSpecURI, uint256 indexed payout, uint256 indexed duration, string details )`
- `JobDisapproved(uint256 indexed jobId, address indexed validator)`
- `JobDisputed(uint256 indexed jobId, address indexed disputant)`
- `JobExpired(uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout)`
- `JobValidated(uint256 indexed jobId, address indexed validator)`
- `MerkleRootsUpdated(bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot)`
- `NFTIssued(uint256 indexed tokenId, address indexed employer, string tokenURI)`
- `NameWrapperUpdated(address newNameWrapper)`
- `PlatformRevenueAccrued(uint256 indexed jobId, uint256 indexed amount)`
- `ReputationUpdated(address user, uint256 newReputation)`
- `RequiredValidatorApprovalsUpdated(uint256 indexed oldApprovals, uint256 indexed newApprovals)`
- `RequiredValidatorDisapprovalsUpdated(uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals)`
- `RootNodesUpdated( bytes32 indexed clubRootNode, bytes32 indexed agentRootNode, bytes32 indexed alphaClubRootNode, bytes32 alphaAgentRootNode )`
- `SettlementPauseSet(address indexed setter, bool indexed paused)`
- `ValidationRewardPercentageUpdated(uint256 indexed oldPercentage, uint256 indexed newPercentage)`
- `ValidatorBlacklisted(address indexed validator, bool indexed status)`
- `ValidatorBondParamsUpdated(uint256 indexed bps, uint256 indexed min, uint256 indexed max)`
- `ValidatorSlashBpsUpdated(uint256 indexed oldBps, uint256 indexed newBps)`
- `VoteQuorumUpdated(uint256 indexed oldQuorum, uint256 indexed newQuorum)`

## Errors index

- `Blacklisted()`
- `ConfigLocked()`
- `IneligibleAgentPayout()`
- `InsolventEscrowBalance()`
- `InsufficientWithdrawableBalance()`
- `InvalidParameters()`
- `InvalidState()`
- `InvalidValidatorThresholds()`
- `JobNotFound()`
- `NotAuthorized()`
- `NotModerator()`
- `SettlementPaused()`
- `TransferFailed()`
- `ValidatorLimitReached()`

## Notes on best-effort integrations

- ENS ownership checks, ENSJobPages hooks, and `tokenURI` enrichment are best-effort integrations.
- Escrow safety and settlement correctness must not depend on hook success.
