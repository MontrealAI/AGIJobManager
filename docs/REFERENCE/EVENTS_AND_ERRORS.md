# Events and Errors Reference (Generated)

- Generated at (deterministic source fingerprint): `0e8518e13648`.
- Source: `contracts/AGIJobManager.sol`.

## Events catalog

| Event | Parameters | When emitted | Monitoring & alert guidance |
| --- | --- | --- | --- |
| `AgentBlacklisted` | `address indexed agent, bool indexed status` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `AgentBondMinUpdated` | `uint256 indexed oldMin, uint256 indexed newMin` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `AgentBondParamsUpdated` | `uint256 indexed oldBps, uint256 indexed oldMin, uint256 indexed oldMax, uint256 newBps, uint256 newMin, uint256 newMax` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `AGITokenAddressUpdated` | `address indexed oldToken, address indexed newToken` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `AGITypeUpdated` | `address indexed nftAddress, uint256 indexed payoutPercentage` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `AGIWithdrawn` | `address indexed to, uint256 indexed amount, uint256 remainingWithdrawable` | Owner treasury withdrawal | High-severity treasury-control alert |
| `ChallengePeriodAfterApprovalUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `CompletionReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `DisputeResolvedWithCode` | `uint256 indexed jobId, address indexed resolver, uint8 indexed resolutionCode, string reason` | Moderator or owner resolved dispute | Audit resolution code distribution and reasons |
| `DisputeReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `EnsHookAttempted` | `uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `EnsJobPagesUpdated` | `address indexed oldEnsJobPages, address indexed newEnsJobPages` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `EnsRegistryUpdated` | `address newEnsRegistry` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `IdentityConfigurationLocked` | `address indexed locker, uint256 indexed atTimestamp` | Identity wiring permanently locked | Governance milestone (one-way control) |
| `JobApplied` | `uint256 indexed jobId, address indexed agent` | Agent assigned and bond locked | Detect assignment churn and anti-takeover posture |
| `JobCancelled` | `uint256 indexed jobId` | Unassigned job cancelled | Confirm escrow release to employer |
| `JobCompleted` | `uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints` | Settlement in favor of agent | Reconcile payout and validator reward flows |
| `JobCompletionRequested` | `uint256 indexed jobId, address indexed agent, string jobCompletionURI` | Agent submitted completion metadata | Start completion review SLA timers |
| `JobCreated` | `uint256 indexed jobId, string jobSpecURI, uint256 indexed payout, uint256 indexed duration, string details` | New escrow obligation opened | Track escrow growth and job throughput |
| `JobDisapproved` | `uint256 indexed jobId, address indexed validator` | Validator disapproval vote | Alert when disapproval velocity accelerates |
| `JobDisputed` | `uint256 indexed jobId, address indexed disputant` | Dispute lane entered | Page moderator operations queue |
| `JobExpired` | `uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout` | Job missed deadline and expired | Track employer protection triggers |
| `JobValidated` | `uint256 indexed jobId, address indexed validator` | Validator approval vote | Track validator participation and threshold trajectory |
| `MerkleRootsUpdated` | `bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `NameWrapperUpdated` | `address newNameWrapper` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `NFTIssued` | `uint256 indexed tokenId, address indexed employer, string tokenURI` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `PlatformRevenueAccrued` | `uint256 indexed jobId, uint256 indexed amount` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `ReputationUpdated` | `address user, uint256 newReputation` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `RequiredValidatorApprovalsUpdated` | `uint256 indexed oldApprovals, uint256 indexed newApprovals` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `RequiredValidatorDisapprovalsUpdated` | `uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `RootNodesUpdated` | `bytes32 indexed clubRootNode, bytes32 indexed agentRootNode, bytes32 indexed alphaClubRootNode, bytes32 alphaAgentRootNode` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `SettlementPauseSet` | `address indexed setter, bool indexed paused` | Settlement lane pause toggled | Critical operations-state alert |
| `ValidationRewardPercentageUpdated` | `uint256 indexed oldPercentage, uint256 indexed newPercentage` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `ValidatorBlacklisted` | `address indexed validator, bool indexed status` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `ValidatorBondParamsUpdated` | `uint256 indexed bps, uint256 indexed min, uint256 indexed max` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `ValidatorSlashBpsUpdated` | `uint256 indexed oldBps, uint256 indexed newBps` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |
| `VoteQuorumUpdated` | `uint256 indexed oldQuorum, uint256 indexed newQuorum` | Contract-defined emission point | Add event-specific monitors in SOC pipeline |

## Errors catalog

| Error | Parameters | Likely causes | Remediation |
| --- | --- | --- | --- |
| `Blacklisted` | — | Caller is blocked by operator policy | Review blacklist rationale and incident policy |
| `ConfigLocked` | — | Contract-defined guard violation | Inspect transaction traces and state getters |
| `IneligibleAgentPayout` | — | Contract-defined guard violation | Inspect transaction traces and state getters |
| `InsolventEscrowBalance` | — | Escrow solvency guard tripped | Pause operations, investigate accounting divergence, run incident response |
| `InsufficientWithdrawableBalance` | — | Treasury withdrawal exceeds withdrawableAGI | Reconcile locked escrow/bonds before retry |
| `InvalidParameters` | — | Out-of-range config value or malformed input | Run scripts/ops/validate-params.js before submitting |
| `InvalidState` | — | Function called in wrong lifecycle phase | Check job status flags and review/dispute windows |
| `InvalidValidatorThresholds` | — | Contract-defined guard violation | Inspect transaction traces and state getters |
| `JobNotFound` | — | Unknown job id or deleted/cancelled struct | Verify event history and live jobId range |
| `NotAuthorized` | — | Caller failed eligibility/role checks | Validate allowlists, proofs, ENS ownership, blacklist status |
| `NotModerator` | — | Unauthorized dispute-resolution call | Use approved moderator signer or owner stale-resolution lane |
| `SettlementPaused` | — | Settlement lane currently paused | Follow incident runbook; unpause only after safety checks |
| `TransferFailed` | — | ERC20 transfer/transferFrom failed or malformed return | Confirm balance/allowance and exact-transfer token semantics |
| `ValidatorLimitReached` | — | Contract-defined guard violation | Inspect transaction traces and state getters |

## Source files used

- `contracts/AGIJobManager.sol`
