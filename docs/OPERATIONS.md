# Operations Guide

## Day-2 operating model

`AGIJobManager` is owner-operated with moderator-assisted dispute handling. There is no autonomous governance module in current code.

## Monitoring and alerting

### Recommended event subscriptions

- High priority:
  - `JobDisputed`
  - `DisputeResolvedWithCode`
  - `SettlementPauseSet`
  - `AGIWithdrawn`
  - `EnsHookAttempted` (failed attempts)
- Operational throughput:
  - `JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobCompleted`, `JobExpired`, `JobCancelled`
- Configuration/control changes:
  - `RequiredValidatorApprovalsUpdated`, `RequiredValidatorDisapprovalsUpdated`, `VoteQuorumUpdated`
  - `ValidationRewardPercentageUpdated`, bond parameter events
  - `EnsRegistryUpdated`, `NameWrapperUpdated`, `RootNodesUpdated`, `MerkleRootsUpdated`, `IdentityConfigurationLocked`

### Incident criteria (suggested)

Treat as incidents when:
- Dispute rate spikes unexpectedly.
- `EnsHookAttempted.success=false` spikes (ENS integration degradation).
- Unexpected owner withdrawals (`AGIWithdrawn`).
- Repeated settlement failures due to pause flags.

## Incident response playbooks

### Playbook A — Pause only

Use when you want to stop *new* activity but still allow settlement paths that are not `whenNotPaused`-gated.

1. Owner calls `pause()`.
2. Continue resolving disputes/finalizations if safe.
3. Investigate root cause.
4. `unpause()` after remediation.

### Playbook B — Hard settlement freeze

Use when settlement itself must stop.

1. Owner calls `setSettlementPaused(true)`.
2. Optionally also `pause()` to block intake.
3. Resolve issue and produce operator postmortem.
4. Re-enable with `setSettlementPaused(false)` and `unpause()`.

## Dispute handling policy (moderators)

- Moderator actions should use `resolveDisputeWithCode(jobId, code, reason)` for typed auditability.
- `code=0` logs no-action and keeps dispute open.
- `code=1` settles to agent win; `code=2` settles to employer win.
- If moderators are unavailable past `disputeReviewPeriod`, owner may use `resolveStaleDispute`.

### Audit trail expectations

Maintain off-chain ticket/incident ID mapping to:
- `JobDisputed` tx hash,
- `DisputeResolvedWithCode` tx hash,
- rationale text (`reason`) and signer identity.

## Key management guidance

- Owner key should be operationally hardened (hardware-backed signing and multi-person process where possible).
- Keep deployment keys separate from day-2 owner key where practical.
- Never commit private keys or RPC secrets; use environment variables only.

## Upgrade/immutability posture

- Contracts are not proxy-upgradeable in this repo.
- Operationally, changes happen via owner setters and policy controls.
- `lockIdentityConfiguration` is irreversible and freezes identity wiring only (not all governance knobs).
