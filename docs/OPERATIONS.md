# Operations (Day-2)

## Monitoring and alerting
Subscribe to:
- Lifecycle: `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobCancelled`
- Governance/control: `SettlementPauseSet`, `IdentityConfigurationLocked`, `RequiredValidator*Updated`, `VoteQuorumUpdated`, `ValidationRewardPercentageUpdated`
- Disputes: `JobDisputed`, `DisputeResolvedWithCode`
- Treasury/risk: `PlatformRevenueAccrued`, `AGIWithdrawn`
- ENS health: `EnsHookAttempted`

### Incident conditions (recommended)
- Spike in `JobDisputed` rate.
- Repeated `EnsHookAttempted(..., success=false)`.
- Unexpected `AGIWithdrawn`.
- Configuration changes outside approved windows.

## Key management guidance
- Keep owner key in hardened custody (multisig/cold policy if available in your stack).
- Separate moderator keys from owner key.
- Maintain explicit signer rotation and revocation process.

## Playbooks: `pause` vs `settlementPaused`

### Pause playbook (`pause()`)
Use when you need to stop new job creation/applications/votes/disputes quickly while preserving ability to unwind selected flows.

### Settlement pause playbook (`setSettlementPaused(true)`)
Use when settlement/dispute-sensitive functions must be halted (`finalizeJob`, `cancelJob`, `expireJob`, dispute resolution, withdraw).

### Combined emergency posture
1. `pause()`
2. `setSettlementPaused(true)`
3. assess outstanding jobs/disputes
4. apply remediation
5. re-enable in controlled order (`setSettlementPaused(false)` then `unpause()`).

## Dispute handling policy
- Moderators should use `resolveDisputeWithCode` and include a meaningful reason string.
- Keep an off-chain case record keyed by `jobId` and transaction hash.
- Escalate unresolved disputes before `disputeReviewPeriod` expiry to avoid owner stale-dispute fallback unless that policy is explicitly intended.
