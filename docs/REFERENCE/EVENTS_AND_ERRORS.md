# Events and Errors Reference (Generated)

- Source snapshot fingerprint: `7abbc1716605`.
- Source: `contracts/AGIJobManager.sol`.

## Events catalog

| Event | Parameters | Monitoring note |
| --- | --- | --- |
| `AgentBlacklisted` | `address indexed agent, bool indexed status` | Trigger high-priority operational/governance alerts. |
| `AgentBondMinUpdated` | `uint256 indexed oldMin, uint256 indexed newMin` | Index for audit trail completeness and anomaly detection. |
| `AgentBondParamsUpdated` | `uint256 indexed oldBps, uint256 indexed oldMin, uint256 indexed oldMax, uint256 newBps, uint256 newMin, uint256 newMax` | Index for audit trail completeness and anomaly detection. |
| `AGITokenAddressUpdated` | `address indexed oldToken, address indexed newToken` | Index for audit trail completeness and anomaly detection. |
| `AGITypeUpdated` | `address indexed nftAddress, uint256 indexed payoutPercentage` | Index for audit trail completeness and anomaly detection. |
| `AGIWithdrawn` | `address indexed to, uint256 indexed amount, uint256 remainingWithdrawable` | Treasury movement; review against change-management approvals. |
| `ChallengePeriodAfterApprovalUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Index for audit trail completeness and anomaly detection. |
| `CompletionReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Index for audit trail completeness and anomaly detection. |
| `DisputeResolvedWithCode` | `uint256 indexed jobId, address indexed resolver, uint8 indexed resolutionCode, string reason` | Trigger high-priority operational/governance alerts. |
| `DisputeReviewPeriodUpdated` | `uint256 indexed oldPeriod, uint256 indexed newPeriod` | Trigger high-priority operational/governance alerts. |
| `EnsHookAttempted` | `uint8 indexed hook, uint256 indexed jobId, address indexed target, bool success` | Index for audit trail completeness and anomaly detection. |
| `EnsJobPagesUpdated` | `address indexed oldEnsJobPages, address indexed newEnsJobPages` | Index for audit trail completeness and anomaly detection. |
| `EnsRegistryUpdated` | `address newEnsRegistry` | Index for audit trail completeness and anomaly detection. |
| `IdentityConfigurationLocked` | `address indexed locker, uint256 indexed atTimestamp` | Index for audit trail completeness and anomaly detection. |
| `JobApplied` | `uint256 indexed jobId, address indexed agent` | Track new liabilities and bond locks. |
| `JobCancelled` | `uint256 indexed jobId` | Reconcile escrow release and terminal status accounting. |
| `JobCompleted` | `uint256 indexed jobId, address indexed agent, uint256 indexed reputationPoints` | Reconcile escrow release and terminal status accounting. |
| `JobCompletionRequested` | `uint256 indexed jobId, address indexed agent, string jobCompletionURI` | Monitor review-window progress and validator participation. |
| `JobCreated` | `uint256 indexed jobId, string jobSpecURI, uint256 indexed payout, uint256 indexed duration, string details` | Track new liabilities and bond locks. |
| `JobDisapproved` | `uint256 indexed jobId, address indexed validator` | Monitor review-window progress and validator participation. |
| `JobDisputed` | `uint256 indexed jobId, address indexed disputant` | Trigger high-priority operational/governance alerts. |
| `JobExpired` | `uint256 indexed jobId, address indexed employer, address agent, uint256 indexed payout` | Reconcile escrow release and terminal status accounting. |
| `JobValidated` | `uint256 indexed jobId, address indexed validator` | Monitor review-window progress and validator participation. |
| `MerkleRootsUpdated` | `bytes32 validatorMerkleRoot, bytes32 agentMerkleRoot` | Index for audit trail completeness and anomaly detection. |
| `NameWrapperUpdated` | `address newNameWrapper` | Index for audit trail completeness and anomaly detection. |
| `NFTIssued` | `uint256 indexed tokenId, address indexed employer, string tokenURI` | Index for audit trail completeness and anomaly detection. |
| `PlatformRevenueAccrued` | `uint256 indexed jobId, uint256 indexed amount` | Index for audit trail completeness and anomaly detection. |
| `ReputationUpdated` | `address user, uint256 newReputation` | Index for audit trail completeness and anomaly detection. |
| `RequiredValidatorApprovalsUpdated` | `uint256 indexed oldApprovals, uint256 indexed newApprovals` | Index for audit trail completeness and anomaly detection. |
| `RequiredValidatorDisapprovalsUpdated` | `uint256 indexed oldDisapprovals, uint256 indexed newDisapprovals` | Index for audit trail completeness and anomaly detection. |
| `RootNodesUpdated` | `bytes32 indexed clubRootNode, bytes32 indexed agentRootNode, bytes32 indexed alphaClubRootNode, bytes32 alphaAgentRootNode` | Index for audit trail completeness and anomaly detection. |
| `SettlementPauseSet` | `address indexed setter, bool indexed paused` | Index for audit trail completeness and anomaly detection. |
| `ValidationRewardPercentageUpdated` | `uint256 indexed oldPercentage, uint256 indexed newPercentage` | Index for audit trail completeness and anomaly detection. |
| `ValidatorBlacklisted` | `address indexed validator, bool indexed status` | Trigger high-priority operational/governance alerts. |
| `ValidatorBondParamsUpdated` | `uint256 indexed bps, uint256 indexed min, uint256 indexed max` | Index for audit trail completeness and anomaly detection. |
| `ValidatorSlashBpsUpdated` | `uint256 indexed oldBps, uint256 indexed newBps` | Index for audit trail completeness and anomaly detection. |
| `VoteQuorumUpdated` | `uint256 indexed oldQuorum, uint256 indexed newQuorum` | Index for audit trail completeness and anomaly detection. |

## Errors catalog

| Error | Parameters | Operator remediation |
| --- | --- | --- |
| `Blacklisted` | — | Review blacklist policy, incident context, and off-chain identity evidence. |
| `ConfigLocked` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |
| `IneligibleAgentPayout` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |
| `InsolventEscrowBalance` | — | Validate token approvals/balances and locked accounting buckets. |
| `InsufficientWithdrawableBalance` | — | Validate token approvals/balances and locked accounting buckets. |
| `InvalidParameters` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |
| `InvalidState` | — | Re-check lifecycle getters and timing windows before retrying. |
| `InvalidValidatorThresholds` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |
| `JobNotFound` | — | Use the correct role signer and verify allowlist/ownership requirements. |
| `NotAuthorized` | — | Use the correct role signer and verify allowlist/ownership requirements. |
| `NotModerator` | — | Use the correct role signer and verify allowlist/ownership requirements. |
| `SettlementPaused` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |
| `TransferFailed` | — | Validate token approvals/balances and locked accounting buckets. |
| `ValidatorLimitReached` | — | Inspect input parameters, prerequisites, and current configuration before retrying. |

## Operational note

Use this index with [docs/OPERATIONS/MONITORING.md](../OPERATIONS/MONITORING.md) for alert routing and with [docs/OPERATIONS/INCIDENT_RESPONSE.md](../OPERATIONS/INCIDENT_RESPONSE.md) for runbook actions.
