# AGIJobManager Interface Reference (Generated)

- Generated at (deterministic source fingerprint): `1ed7c723a538`.
- Source snapshot fingerprint: `1ed7c723a538`.
- Source: `contracts/AGIJobManager.sol`.

## Operator-facing interface

### Public state variables

| Variable | Type |
| --- | --- |
| `agentBond` | `uint256` |
| `agentBondBps` | `uint256` |
| `agentBondMax` | `uint256` |
| `agentMerkleRoot` | `bytes32` |
| `agentNftRequired` | `bool` |
| `agentRootNode` | `bytes32` |
| `agiTypes` | `NftEligibility.AGIType[]` |
| `alphaAgentRootNode` | `bytes32` |
| `alphaClubRootNode` | `bytes32` |
| `challengePeriodAfterApproval` | `uint256` |
| `clubRootNode` | `bytes32` |
| `completionReviewPeriod` | `uint256` |
| `disputeReviewPeriod` | `uint256` |
| `ens` | `ENS` |
| `ensJobPages` | `address` |
| `jobDurationLimit` | `uint256` |
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
| `wallet10` | `address` |
| `wallet30` | `address` |

### External/Public functions

| Signature | Visibility | Mutability | Returns |
| --- | --- | --- | --- |
| `acceptJob(uint256 jobId)` | external | nonpayable | — |
| `addAdditionalAgent(address agent)` | external | nonpayable | — |
| `addAdditionalValidator(address validator)` | external | nonpayable | — |
| `addAGIType(address nftAddress, uint256 payoutPercentage)` | external | nonpayable | — |
| `addModerator(address _moderator)` | external | nonpayable | — |
| `applyForJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `blacklistAgent(address _agent, bool _status)` | external | nonpayable | — |
| `blacklistValidator(address _validator, bool _status)` | external | nonpayable | — |
| `cancelJob(uint256 _jobId)` | external | nonpayable | — |
| `claimUSDC(address beneficiary)` | external | nonpayable | — |
| `createJob(string memory _jobSpecURI, uint256 _payout, uint256 _duration, string memory _details)` | external | nonpayable | — |
| `delistJob(uint256 _jobId)` | external | nonpayable | — |
| `disableAGIType(address nftAddress)` | external | nonpayable | — |
| `disapproveJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `disputeJob(uint256 _jobId)` | external | nonpayable | — |
| `executeUSDCTransfer(address beneficiary, uint256 amount)` | external | nonpayable | — |
| `expireJob(uint256 _jobId)` | external | nonpayable | — |
| `finalizeJob(uint256 jobId)` | external | nonpayable | — |
| `getHighestPayoutPercentage(address agent)` | public | view | `uint256` |
| `getJobBonds(uint256 jobId)` | external | view | `uint256 agentAmount, uint256 validatorAmount, bool validatorFixed, uint256 disputeAmount` |
| `getJobCompletionURI(uint256 jobId)` | external | view | `string memory` |
| `getJobCore(uint256 jobId)` | external | view | `address employer, address assignedAgent, uint256 payout, uint256 duration, uint256 assignedAt, bool completed, bool disputed, bool expired, uint8 agentPayoutPct` |
| `getJobDeadlines(uint256 jobId)` | external | view | `uint256 assignmentDeadline, uint256 reviewEnd, uint256 settlementAfter, uint256 ownerResolutionAfter, uint256 neutralRefundAfter` |
| `getJobSpecURI(uint256 jobId)` | external | view | `string memory` |
| `getJobValidation(uint256 jobId)` | external | view | `bool completionRequested, uint256 validatorApprovals, uint256 validatorDisapprovals, uint256 completionRequestedAt, uint256 disputedAt` |
| `jobAgentNftRequired(uint256 jobId)` | external | view | `bool` |
| `lockedAgentBonds()` | external | view | `uint256` |
| `lockedClaims()` | external | view | `uint256` |
| `lockedDisputeBonds()` | external | view | `uint256` |
| `lockedEscrow()` | external | view | `uint256` |
| `lockedValidatorBonds()` | external | view | `uint256` |
| `lockIdentityConfiguration()` | external | nonpayable | — |
| `lockJobENS(uint256 jobId, bool burnFuses)` | external | nonpayable | — |
| `ownerOf(uint256 id)` | external | view | `address` |
| `pause()` | external | nonpayable | — |
| `pauseAll()` | external | nonpayable | — |
| `pauseIntake()` | external | nonpayable | — |
| `pendingUSDC(address beneficiary)` | external | view | `uint256` |
| `refundUnresolvedDispute(uint256 jobId)` | external | nonpayable | — |
| `removeAdditionalAgent(address agent)` | external | nonpayable | — |
| `removeAdditionalValidator(address validator)` | external | nonpayable | — |
| `removeModerator(address _moderator)` | external | nonpayable | — |
| `renounceOwnership()` | public | pure | — |
| `reputation(address account)` | external | view | `uint256` |
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
| `setAgentNftRequired(bool required)` | external | nonpayable | — |
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
| `setSettlementWallets(address recipient30, address recipient10)` | external | nonpayable | — |
| `settlementPausedSeconds()` | public | view | `uint256` |
| `setUseEnsJobTokenURI(bool enabled)` | external | nonpayable | — |
| `setValidationRewardPercentage(uint256 _percentage)` | external | nonpayable | — |
| `setValidatorBondParams(uint256 bps, uint256 min, uint256 max)` | external | nonpayable | — |
| `setValidatorSlashBps(uint256 bps)` | external | nonpayable | — |
| `setVoteQuorum(uint256 _quorum)` | external | nonpayable | — |
| `tokenURI(uint256 tokenId)` | public | view | `string memory` |
| `unpause()` | external | nonpayable | — |
| `unpauseAll()` | external | nonpayable | — |
| `unpauseIntake()` | external | nonpayable | — |
| `updateEnsRegistry(address _newEnsRegistry)` | external | nonpayable | — |
| `updateMerkleRoots(bytes32 _validatorMerkleRoot, bytes32 _agentMerkleRoot)` | external | nonpayable | — |
| `updateNameWrapper(address _newNameWrapper)` | external | nonpayable | — |
| `updateRootNodes(bytes32 _clubRootNode, bytes32 _agentRootNode, bytes32 _alphaClubRootNode, bytes32 _alphaAgentRootNode)` | external | nonpayable | — |
| `validateJob(uint256 _jobId, string memory subdomain, bytes32[] calldata proof)` | external | nonpayable | — |
| `validatorCredential(address claimant, string memory label, bytes32[] calldata proof)` | public | view | `bytes32 credential, address controller` |
| `withdrawableUSDC()` | public | view | `uint256` |
| `withdrawUSDC(uint256 amount)` | external | nonpayable | — |

## Events index

| Event | Parameters |
| --- | --- |
| `AgentBlacklisted` | `address indexed agent, bool indexed status` |
| `AgentBondMinUpdated` | `uint256 indexed oldMin, uint256 indexed newMin` |
| `AgentBondParamsUpdated` | `uint256 indexed oldBps, uint256 indexed oldMin, uint256 indexed oldMax, uint256 newBps, uint256 newMin, uint256 newMax` |
| `AgentNftRequirementUpdated` | `bool required` |
| `AGITypeUpdated` | `address indexed nftAddress, uint256 indexed payoutPercentage` |
| `ChallengePeriodAfterApprovalUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `CompletionReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `DisputeResolvedWithCode` | `uint256 indexed jobId, address indexed resolver, uint8 indexed resolutionCode, string reason` |
| `DisputeReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` |
| `EnsHookAttempted` | `uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success` |
| `EnsJobPagesUpdated` | `address indexed oldEnsJobPages, address indexed newEnsJobPages` |
| `EnsRegistryUpdated` | `address newEnsRegistry` |
| `IdentityConfigurationLocked` | `address indexed locker, uint256 indexed atTimestamp` |
| `JobAccepted` | `uint256 indexed jobId, address indexed employer` |
| `JobApplied` | `uint256 indexed jobId, address indexed agent` |
| `JobApprovalThresholdReached` | `uint256 indexed jobId, uint256 approvedAt` |
| `JobCancelled` | `uint256 indexed jobId` |
| `JobCompleted` | `uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints` |
| `JobCompletionRequested` | `uint256 indexed jobId, address indexed agent, string jobCompletionURI` |
| `JobCreated` | `uint256 indexed jobId, string jobSpecURI, uint256 indexed payout, uint256 indexed duration, string details` |
| `JobDisapproved` | `uint256 indexed jobId, address indexed validator` |
| `JobDisputed` | `uint256 indexed jobId, address indexed disputant` |
| `JobDurationLimitUpdated` | `uint256 indexed oldLimit, uint256 indexed newLimit` |
| `JobExpired` | `uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout` |
| `JobPayoutDistributed` | `uint256 indexed jobId, uint256 validatorBudget, uint256 wallet30Amount, uint256 wallet10Amount, uint256 agentAmount` |
| `JobValidated` | `uint256 indexed jobId, address indexed validator` |
| `MaxJobPayoutUpdated` | `uint256 indexed oldPayout, uint256 indexed newPayout` |
| `MerkleRootsUpdated` | `bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot` |
| `NameWrapperUpdated` | `address newNameWrapper` |
| `NFTIssued` | `uint256 indexed tokenId, address indexed employer, string tokenURI` |
| `ReputationUpdated` | `address user, uint256 newReputation` |
| `RequiredValidatorApprovalsUpdated` | `uint256 indexed oldApprovals, uint256 indexed newApprovals` |
| `RequiredValidatorDisapprovalsUpdated` | `uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals` |
| `RootNodesUpdated` | `bytes32 indexed clubRootNode, bytes32 indexed agentRootNode, bytes32 indexed alphaClubRootNode, bytes32 alphaAgentRootNode` |
| `SettlementPauseSet` | `address indexed setter, bool indexed paused` |
| `SettlementWalletsUpdated` | `address indexed wallet30, address indexed wallet10` |
| `UnresolvedDisputeRefunded` | `uint256 indexed jobId` |
| `USDCClaimed` | `address indexed beneficiary, uint256 amount` |
| `USDCDeferred` | `address indexed beneficiary, uint256 amount` |
| `USDCWithdrawn` | `address indexed to, uint256 indexed amount, uint256 remainingWithdrawable` |
| `ValidationRewardPercentageUpdated` | `uint256 indexed oldPercentage, uint256 indexed newPercentage` |
| `ValidatorBlacklisted` | `address indexed validator, bool indexed status` |
| `ValidatorBondParamsUpdated` | `uint256 indexed bps, uint256 indexed min, uint256 indexed max` |
| `ValidatorCredentialUsed` | `uint256 indexed jobId, address indexed voter, bytes32 indexed credential, address controller` |
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
- Settlement safety is enforced by USDC token balances, locked accounting buckets, and state transition guards.

## Source files used

- `contracts/AGIJobManager.sol`
