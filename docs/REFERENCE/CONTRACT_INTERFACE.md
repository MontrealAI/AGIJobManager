# AGIJobManager Interface Reference (Generated)

- Generated at (deterministic source fingerprint): `f3122a317e45`.
- Source snapshot fingerprint: `f3122a317e45`.
- Source: `contracts/AGIJobManager.sol`.

## Operator-facing interface

### Public state variables

| Variable | Type |
| --- | --- |
| `agentBond` | `uint256` |
| `agentBondBps` | `uint256` |
| `agentBondMax` | `uint256` |
| `agentMerkleRoot` | `bytes32` |
| `agentRootNode` | `bytes32` |
| `agiToken` | `IERC20` |
| `agiTypes` | `AGIType[]` |
| `alphaAgentRootNode` | `bytes32` |
| `alphaClubRootNode` | `bytes32` |
| `challengePeriodAfterApproval` | `uint256` |
| `clubRootNode` | `bytes32` |
| `completionReviewPeriod` | `uint256` |
| `disputeReviewPeriod` | `uint256` |
| `ens` | `ENS` |
| `ensJobPages` | `address` |
| `jobDurationLimit` | `uint256` |
| `lockedAgentBonds` | `uint256` |
| `lockedDisputeBonds` | `uint256` |
| `lockedEscrow` | `uint256` |
| `lockedValidatorBonds` | `uint256` |
| `lockIdentityConfig` | `bool` |
| `maxActiveJobsPerAgent` | `uint256` |
| `maxJobPayout` | `uint256` |
| `nameWrapper` | `NameWrapper` |
| `nextJobId` | `uint256` |
| `nextTokenId` | `uint256` |
| `premiumReputationThreshold` | `uint256` |
| `requiredValidatorApprovals` | `uint256` |
| `requiredValidatorDisapprovals` | `uint256` |
| `settlementPaused` | `bool` |
| `validationRewardPercentage` | `uint256` |
| `validatorBondBps` | `uint256` |
| `validatorBondMax` | `uint256` |
| `validatorBondMin` | `uint256` |
| `validatorMerkleRoot` | `bytes32` |
| `validatorSlashBps` | `uint256` |
| `voteQuorum` | `uint256` |

### External/Public functions

| Signature | Visibility | Mutability | Returns |
| --- | --- | --- | --- |
| `addAdditionalAgent(address agent)` | external | nonpayable | — |
| `addAdditionalValidator(address validator)` | external | nonpayable | — |
| `addAGIType(address nftAddress, uint256 payoutPercentage)` | external | nonpayable | — |
| `addModerator(address _moderator)` | external | nonpayable | — |
| `applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `blacklistAgent(address _agent, bool _status)` | external | nonpayable | — |
| `blacklistValidator(address _validator, bool _status)` | external | nonpayable | — |
| `cancelJob(uint256 _jobId)` | external | nonpayable | — |
| `createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details)` | external | nonpayable | — |
| `delistJob(uint256 _jobId)` | external | nonpayable | — |
| `disableAGIType(address nftAddress)` | external | nonpayable | — |
| `disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `disputeJob(uint256 _jobId)` | external | nonpayable | — |
| `expireJob(uint256 _jobId)` | external | nonpayable | — |
| `finalizeJob(uint256 _jobId)` | external | nonpayable | — |
| `getHighestPayoutPercentage(address agent)` | public | view | `uint256` |
| `getJobCompletionURI(uint256 jobId)` | external | view | `string memory` |
| `getJobCore(uint256 jobId)` | external | view | `address employer, address assignedAgent, uint256 payout, uint256 duration, uint256 assignedAt, bool completed, bool disputed, bool expired, uint8 agentPayoutPct` |
| `getJobSpecURI(uint256 jobId)` | external | view | `string memory` |
| `getJobValidation(uint256 jobId)` | external | view | `bool completionRequested, uint256 validatorApprovals, uint256 validatorDisapprovals, uint256 completionRequestedAt, uint256 disputedAt` |
| `lockIdentityConfiguration()` | external | nonpayable | — |
| `lockJobENS(uint256 jobId, bool burnFuses)` | external | nonpayable | — |
| `ownerOf(uint256 id)` | external | view | `address` |
| `pause()` | external | nonpayable | — |
| `pauseAll()` | external | nonpayable | — |
| `pauseIntake()` | external | nonpayable | — |
| `removeAdditionalAgent(address agent)` | external | nonpayable | — |
| `removeAdditionalValidator(address validator)` | external | nonpayable | — |
| `removeModerator(address _moderator)` | external | nonpayable | — |
| `requestJobCompletion(uint256 _jobId, string calldata _jobCompletionURI)` | external | nonpayable | — |
| `rescueERC20(address token, address to, uint256 amount)` | external | nonpayable | — |
| `rescueETH(uint256 amount)` | external | nonpayable | — |
| `rescueToken(address token, bytes calldata data)` | external | nonpayable | — |
| `resolveDisputeWithCode(uint256 _jobId, uint8 resolutionCode, string calldata reason)` | external | nonpayable | — |
| `resolver(bytes32 node)` | external | view | `address` |
| `resolveStaleDispute(uint256 _jobId, bool employerWins)` | external | nonpayable | — |
| `safeMintCompletionNFT(address to, uint256 tokenId)` | external | nonpayable | — |
| `setAgentBond(uint256 bond)` | external | nonpayable | — |
| `setAgentBondParams(uint256 bps, uint256 min, uint256 max)` | external | nonpayable | — |
| `setBaseIpfsUrl(string calldata _url)` | external | nonpayable | — |
| `setChallengePeriodAfterApproval(uint256 period)` | external | nonpayable | — |
| `setCompletionReviewPeriod(uint256 _period)` | external | nonpayable | — |
| `setDisputeReviewPeriod(uint256 _period)` | external | nonpayable | — |
| `setEnsJobPages(address _ensJobPages)` | external | nonpayable | — |
| `setJobDurationLimit(uint256 _limit)` | external | nonpayable | — |
| `setMaxActiveJobsPerAgent(uint256 value)` | external | nonpayable | — |
| `setMaxJobPayout(uint256 _maxPayout)` | external | nonpayable | — |
| `setPremiumReputationThreshold(uint256 _threshold)` | external | nonpayable | — |
| `setRequiredValidatorApprovals(uint256 _approvals)` | external | nonpayable | — |
| `setRequiredValidatorDisapprovals(uint256 _disapprovals)` | external | nonpayable | — |
| `setSettlementPaused(bool paused)` | external | nonpayable | — |
| `setUseEnsJobTokenURI(bool enabled)` | external | nonpayable | — |
| `setValidationRewardPercentage(uint256 _percentage)` | external | nonpayable | — |
| `setValidatorBondParams(uint256 bps, uint256 min, uint256 max)` | external | nonpayable | — |
| `setValidatorSlashBps(uint256 bps)` | external | nonpayable | — |
| `setVoteQuorum(uint256 _quorum)` | external | nonpayable | — |
| `tokenURI(uint256 tokenId)` | public | view | `string memory` |
| `unpause()` | external | nonpayable | — |
| `unpauseAll()` | external | nonpayable | — |
| `unpauseIntake()` | external | nonpayable | — |
| `updateAGITokenAddress(address _newTokenAddress)` | external | nonpayable | — |
| `updateEnsRegistry(address _newEnsRegistry)` | external | nonpayable | — |
| `updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` | external | nonpayable | — |
| `updateNameWrapper(address _newNameWrapper)` | external | nonpayable | — |
| `updateRootNodes(bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _alphaClubRootNode, bytes32 _alphaAgentRootNode)` | external | nonpayable | — |
| `validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `withdrawableAGI()` | public | view | `uint256` |
| `withdrawAGI(uint256 amount)` | external | nonpayable | — |

## Events index

| Event | Parameters |
| --- | --- |
| `AgentBlacklisted` | `address indexed agent, bool indexed status` |
| `AgentBondMinUpdated` | `uint256 indexed oldMin, uint256 indexed newMin` |
| `AgentBondParamsUpdated` | `uint256 indexed oldBps, uint256 indexed oldMin, uint256 indexed oldMax, uint256 newBps, uint256 newMin, uint256 newMax` |
| `AGITokenAddressUpdated` | `address indexed oldToken, address indexed newToken` |
| `AGITypeUpdated` | `address indexed nftAddress, uint256 indexed payoutPercentage` |
| `AGIWithdrawn` | `address indexed to, uint256 indexed amount, uint256 remainingWithdrawable` |
| `ChallengePeriodAfterApprovalUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `CompletionReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `DisputeResolvedWithCode` | `uint256 indexed jobId, address indexed resolver, uint8 indexed resolutionCode, string reason` |
| `DisputeReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `EnsHookAttempted` | `uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success` |
| `EnsJobPagesUpdated` | `address indexed oldEnsJobPages, address indexed newEnsJobPages` |
| `EnsRegistryUpdated` | `address newEnsRegistry` |
| `IdentityConfigurationLocked` | `address indexed locker, uint256 indexed atTimestamp` |
| `JobApplied` | `uint256 indexed jobId, address indexed agent` |
| `JobCancelled` | `uint256 indexed jobId` |
| `JobCompleted` | `uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints` |
| `JobCompletionRequested` | `uint256 indexed jobId, address indexed agent, string jobCompletionURI` |
| `JobCreated` | `uint256 indexed jobId, string jobSpecURI, uint256 indexed payout, uint256 indexed duration, string details` |
| `JobDisapproved` | `uint256 indexed jobId, address indexed validator` |
| `JobDisputed` | `uint256 indexed jobId, address indexed disputant` |
| `JobExpired` | `uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout` |
| `JobValidated` | `uint256 indexed jobId, address indexed validator` |
| `MaxActiveJobsPerAgentUpdated` | `uint256 oldValue, uint256 newValue` |
| `MerkleRootsUpdated` | `bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot` |
| `NameWrapperUpdated` | `address newNameWrapper` |
| `NFTIssued` | `uint256 indexed tokenId, address indexed employer, string tokenURI` |
| `PlatformRevenueAccrued` | `uint256 indexed jobId, uint256 indexed amount` |
| `ReputationUpdated` | `address user, uint256 newReputation` |
| `RequiredValidatorApprovalsUpdated` | `uint256 indexed oldApprovals, uint256 indexed newApprovals` |
| `RequiredValidatorDisapprovalsUpdated` | `uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals` |
| `RootNodesUpdated` | `bytes32 indexed clubRootNode, bytes32 indexed agentRootNode, bytes32 indexed alphaClubRootNode, bytes32 alphaAgentRootNode` |
| `SettlementPauseSet` | `address indexed setter, bool indexed paused` |
| `ValidationRewardPercentageUpdated` | `uint256 indexed oldPercentage, uint256 indexed newPercentage` |
| `ValidatorBlacklisted` | `address indexed validator, bool indexed status` |
| `ValidatorBondParamsUpdated` | `uint256 indexed bps, uint256 indexed min, uint256 indexed max` |
| `ValidatorSlashBpsUpdated` | `uint256 indexed oldBps, uint256 indexed newBps` |
| `VoteQuorumUpdated` | `uint256 indexed oldQuorum, uint256 indexed newQuorum` |

## Errors index

| Error | Parameters |
| --- | --- |
| `Blacklisted` | — |
| `ConfigLocked` | — |
| `IneligibleAgentPayout` | — |
| `InsolventEscrowBalance` | — |
| `InsufficientWithdrawableBalance` | — |
| `InvalidParameters` | — |
| `InvalidState` | — |
| `InvalidValidatorThresholds` | — |
| `JobNotFound` | — |
| `NotAuthorized` | — |
| `NotModerator` | — |
| `SettlementPaused` | — |
| `TransferFailed` | — |
| `ValidatorLimitReached` | — |

## Notes on best-effort integrations

- ENS ownership checks and ENS Job Pages hooks are integration conveniences, not safety preconditions for escrow accounting.
- Settlement safety is enforced by AGI token balances, locked accounting buckets, and state transition guards.

## Source files used

- `contracts/AGIJobManager.sol`
