# AGIJobManager Contract Reference

## Purpose
`AGIJobManager` is the protocol core. It:
- Escrows AGI payouts
- Assigns one eligible agent per job
- Collects validator approvals/disapprovals with bonded voting
- Supports disputes with moderator/owner stale resolution
- Settles escrow + bond accounting
- Mints a completion ERC-721 to employer

## Roles and permissions
- **Owner:** global admin (pause, settlement pause, config, allowlists, identity wiring, treasury withdrawal while paused).
- **Moderator:** resolves active disputes.
- **Employer:** creates/cancels own unassigned jobs; may dispute.
- **Agent:** applies to jobs if eligible; requests completion; may dispute.
- **Validator:** validates/disapproves completion if eligible.

Eligibility for agents/validators is OR-composed:
1. `additionalAgents` / `additionalValidators`, OR
2. Merkle proof (`agentMerkleRoot` / `validatorMerkleRoot`), OR
3. ENS ownership under configured root(s).

## Core state and invariants

### Locked accounting buckets
- `lockedEscrow`: escrowed job payouts.
- `lockedAgentBonds`: active agent bonds.
- `lockedValidatorBonds`: active validator bonds.
- `lockedDisputeBonds`: active dispute bonds.

**Invariant:** `agiToken.balanceOf(this) >= lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds` when querying withdrawable treasury (`withdrawableAGI`).

### Important tunables
- Validator thresholds: `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum`
- Timers: `completionReviewPeriod`, `challengePeriodAfterApproval`, `disputeReviewPeriod`
- Payout/bond knobs: `validationRewardPercentage`, `validatorBond*`, `validatorSlashBps`, `agentBond*`
- Limits: `MAX_VALIDATORS_PER_JOB`, `MAX_AGI_TYPES`, `maxJobPayout`, `jobDurationLimit`

### Identity lock
`lockIdentityConfiguration()` permanently disables token/ENS/root wiring updates (`updateAGITokenAddress`, ENS/root setters, `setEnsJobPages`) by enforcing `whenIdentityConfigurable`.

## Public/external functions by workflow

### 1) Job creation and assignment
- `createJob(string _jobSpecURI, uint256 _payout, uint256 _duration, string _details)`
- `applyForJob(uint256 _jobId, string subdomain, bytes32[] proof)`

Notes:
- Employer escrow transfer happens on create.
- Agent bond is computed and locked on apply.
- Agent payout tier snapshot (`agentPayoutPct`) is based on highest enabled AGIType NFT tier at apply time.

### 2) Completion and validator voting
- `requestJobCompletion(uint256 _jobId, string _jobCompletionURI)`
- `validateJob(uint256 _jobId, string subdomain, bytes32[] proof)`
- `disapproveJob(uint256 _jobId, string subdomain, bytes32[] proof)`
- `finalizeJob(uint256 _jobId)`

`finalizeJob` outcomes:
- Early success path if previously validator-approved and challenge period passed.
- After review period:
  - no votes => deterministic agent win (without reputation eligibility)
  - under quorum or tie => forced dispute
  - majority approvals => agent win
  - majority disapprovals => employer refund path

### 3) Disputes
- `disputeJob(uint256 _jobId)`
- `resolveDispute(uint256 _jobId, string resolution)` (deprecated string path)
- `resolveDisputeWithCode(uint256 _jobId, uint8 resolutionCode, string reason)`
- `resolveStaleDispute(uint256 _jobId, bool employerWins)` (owner-only after timeout)

Resolution codes:
- `0`: no action (dispute remains active)
- `1`: agent win
- `2`: employer win

### 4) Lifecycle exits and cancellation
- `cancelJob(uint256 _jobId)` (employer only, unassigned)
- `expireJob(uint256 _jobId)` (assigned, no completion request, duration elapsed)
- `delistJob(uint256 _jobId)` (owner only, unassigned)
- `lockJobENS(uint256 jobId, bool burnFuses)` (public lock; only owner may burn fuses)

### 5) Read APIs
- `getJobCore(uint256 jobId)`
- `getJobValidation(uint256 jobId)`
- `getJobSpecURI(uint256 jobId)`
- `getJobCompletionURI(uint256 jobId)`
- `tokenURI(uint256 tokenId)`
- `withdrawableAGI()`

### 6) Admin configuration
Representative setters:
- Pauses: `pause`, `unpause`, `setSettlementPaused`
- Validators: threshold/quorum, validator bond/slash params
- Agents: agent bond params, additional agent allowlist
- Identity wiring: ENS registry/wrapper/root nodes/merkle roots and ENSJobPages endpoint (before lock)
- Treasury: `withdrawAGI(uint256 amount)` (owner, paused, settlement not paused)

## Events to monitor (operations)
- Lifecycle: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobCancelled`
- Validation/dispute: `JobValidated`, `JobDisapproved`, `JobDisputed`, `DisputeResolvedWithCode`
- Treasury/accounting: `PlatformRevenueAccrued`, `AGIWithdrawn`, `RewardPoolContribution`
- Risk controls: `SettlementPauseSet`, `IdentityConfigurationLocked`
- ENS integration: `EnsHookAttempted`, `EnsJobPagesUpdated`, `UseEnsJobTokenURIUpdated`

## Gotchas
- `setAdditionalAgentPayoutPercentage(uint256)` is deprecated and intentionally reverts via `DeprecatedParameter()`.
- Settlement pause and global pause are distinct controls.
- ENS hook failures do not revert core settlement paths.
- `lockIdentityConfiguration` is irreversible.
- Treasury withdrawal is blocked unless paused and solvent against locked totals.

## Gas/bounded loop considerations
- Validators list per job is bounded by `MAX_VALIDATORS_PER_JOB` (50).
- AGIType scans are bounded by `MAX_AGI_TYPES` (32).
- Settlement iterates over validators once in `_settleValidators`.
