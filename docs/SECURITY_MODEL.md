# Security Model

## Threat model summary

This system is explicitly **business-operated**:
- owner is highly privileged,
- moderators can determine dispute outcomes,
- validator set is permissioned through allowlists/Merkle/ENS gates,
- ENS integration is auxiliary and non-blocking.

The security objective is solvency and deterministic settlement under this trust model, not trustless governance.

## Critical risk classes and mitigations

### 1) External call failures (ERC20/ENS)
- **Risk**: token transfer failures can corrupt accounting if unchecked.
- **Mitigation**: transfer wrappers (`TransferUtils`) enforce revert on failed/under-delivered transfers.
- **Risk**: ENS hook failures block settlement.
- **Mitigation**: hooks are best effort; settlement continues and logs `EnsHookAttempted`.

### 2) Escrow insolvency / treasury drain
- **Risk**: owner withdrawal touching escrow/bond liabilities.
- **Mitigation**: `withdrawableAGI` subtracts all locked liabilities and reverts on insolvency; `withdrawAGI` also requires paused mode.

### 3) Settlement disruption
- **Risk**: emergency or malformed conditions during settlement.
- **Mitigation**:
  - `settlementPaused` kill-switch for settlement-sensitive paths,
  - separate `Pausable` behavior for `whenNotPaused` flows,
  - stale-dispute owner resolution path after timeout.

### 4) Role compromise scenarios

| Compromised role | Impact | Immediate response |
|---|---|---|
| Owner | full config control, pause controls, stale-dispute authority, treasury withdrawal (subject to locked accounting) | rotate ownership to secure multisig; pause system; audit recent admin events |
| Moderator | can resolve active disputes to chosen side | remove moderator (`removeModerator`), investigate affected jobs, use owner stale-dispute controls where applicable |
| Validator cohort | can bias votes/disputes within thresholds and quorum rules | tune thresholds/quorum and validator bonds; adjust allowlists/blacklists |

## Operational security recommendations

1. Use a multisig as `owner` (recommended operational practice).
2. Keep moderator keys separated from owner key material.
3. Enforce key rotation and hardware-backed signing.
4. Monitor high-impact events in real time.

## Event monitoring priorities

Watch and alert on:
- config/admin: `SettlementPauseSet`, `IdentityConfigurationLocked`, `AGITokenAddressUpdated`, `EnsJobPagesUpdated`, root/merkle update events, bond/threshold update events,
- settlement/dispute: `JobDisputed`, `DisputeResolvedWithCode`, `JobCompleted`, `JobExpired`,
- treasury and accounting: `AGIWithdrawn`, `PlatformRevenueAccrued`,
- ENS health: `EnsHookAttempted` with `success=false`.
