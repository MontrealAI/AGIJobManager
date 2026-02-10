# AGIJobManager Contract Reference

## Purpose
`AGIJobManager` is the protocol core: AGI escrow + job state machine + validator/dispute settlement + reputation + completion NFT minting.

## Key state variables
- Escrow and bond accounting: `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`.
- Lifecycle controls: `paused()` (OZ), `settlementPaused`.
- Validator controls: `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum`, `completionReviewPeriod`, `challengePeriodAfterApproval`, `validator*` params.
- Agent controls: `agentBond`, `agentBondBps`, `agentBondMax`, `maxJobPayout`, `jobDurationLimit`.
- Identity/gating: Merkle roots, ENS roots, `additionalAgents`, `additionalValidators`, blacklists, `lockIdentityConfig`.
- ENS integration: `ensJobPages`, `useEnsJobTokenURI`.

## Roles and permissions
- **Owner**: admin config, pausing, allowlists/blacklists, moderators, AGIType config, treasury withdrawals while paused.
- **Moderator**: resolves disputes.
- **Employer**: creates/cancels jobs, can dispute, receives completion NFT.
- **Agent**: applies, requests completion.
- **Validator**: approves/disapproves completions.

## Public workflows

### 1) Create and assign
- `createJob(string,uint256,uint256,string)`
- `applyForJob(uint256,string,bytes32[])`

### 2) Completion and validation
- `requestJobCompletion(uint256,string)`
- `validateJob(uint256,string,bytes32[])`
- `disapproveJob(uint256,string,bytes32[])`
- `finalizeJob(uint256)`

### 3) Disputes
- `disputeJob(uint256)`
- `resolveDispute(uint256,string)` (deprecated string path)
- `resolveDisputeWithCode(uint256,uint8,string)`
- `resolveStaleDispute(uint256,bool)`

### 4) Exit/cancellation
- `cancelJob(uint256)` employer only pre-assignment.
- `delistJob(uint256)` owner only pre-assignment.
- `expireJob(uint256)` after duration, no completion request.

### 5) Admin configuration
- Identity wiring: `updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `setEnsJobPages`, `updateRootNodes` (all blocked after `lockIdentityConfiguration`).
- Gating roots and lists: `updateMerkleRoots`, additional allowlists, blacklists.
- Economics: `setValidationRewardPercentage`, `setValidatorBondParams`, `setAgentBondParams`, `setValidatorSlashBps`, `setVoteQuorum`, thresholds, review windows.
- Ops controls: `pause`, `unpause`, `setSettlementPaused`, `withdrawAGI`.

## Events (high-signal)
- Lifecycle: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobCancelled`.
- Validation/dispute: `JobValidated`, `JobDisapproved`, `JobDisputed`, `DisputeResolved`, `DisputeResolvedWithCode`.
- Accounting/security: `PlatformRevenueAccrued`, `AGIWithdrawn`, `SettlementPauseSet`, `IdentityConfigurationLocked`.
- ENS: `EnsHookAttempted`, `EnsRegistryUpdated`, `NameWrapperUpdated`, `EnsJobPagesUpdated`, `UseEnsJobTokenURIUpdated`.

## Edge cases and invariants
- `withdrawableAGI()` reverts `InsolventEscrowBalance` if balance is below locked totals; this defends treasury withdrawals.
- Settlement is guarded by both lifecycle checks and `whenSettlementNotPaused` on externally callable settlement endpoints.
- `setAdditionalAgentPayoutPercentage` is intentionally deprecated and always reverts.
- `MAX_VALIDATORS_PER_JOB` bounds validator loop cost in `_settleValidators`.
- Agent-win retained remainder is intentional platform revenue (`PlatformRevenueAccrued`) and only withdrawable under paused treasury rules.

## Gas / loop notes
- Per-job validator loop is capped at 50.
- AGIType scans are capped by `MAX_AGI_TYPES=32`.
- Ownership checks use Merkle verification + ENS checks; callers should provide minimal proofs.

## Read API for integrators
- `getJobCore(jobId)` for core status.
- `getJobValidation(jobId)` for voting/dispute timestamps.
- `getJobSpecURI(jobId)`, `getJobCompletionURI(jobId)`.
- `tokenURI(tokenId)` for completion NFT metadata.
