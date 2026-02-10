# Operations Runbook

## Purpose
Steady-state monitoring, alerting, and incident response procedures.

## Audience
On-call operators, security responders, and owner administrators.

## Preconditions / assumptions
- Access to chain RPC + event indexing.
- Operational ownership key/multisig available for emergency actions.

## Monitoring (minimum)
| Signal | Why it matters |
|---|---|
| `AGI balance` vs `lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds` | Solvency / withdrawal safety. |
| Job lifecycle events | Throughput, stuck states, and liveness checks. |
| Dispute and stale-dispute events | Moderator load and dispute backlog health. |
| `paused` + `settlementPaused` | Service availability state. |
| `EnsHookAttempted` success ratio | ENS integration reliability (non-fatal). |

## Suggested alert conditions
- **Critical:** `withdrawableAGI()` reverts `InsolventEscrowBalance`.
- **Critical:** unexpected pause toggles without approved change ticket.
- **High:** disputes older than `disputeReviewPeriod` without resolution.
- **High:** sustained `EnsHookAttempted(...,false)` above normal baseline.
- **Medium:** repeated settlement reverts for similar job states.

## Incident playbooks

### 1) ENS hooks failing
1. Confirm escrow flow still progresses.
2. Inspect ENSJobPages config (`ens`, `nameWrapper`, resolver, root node).
3. Decide whether to disable ENS URI mode (`setUseEnsJobTokenURI(false)`).

### 2) Validator participation failure
1. Inspect validator set health and recent `JobValidated` / `JobDisapproved` volume.
2. Temporarily rely on moderator dispute path for blocked jobs.
3. Adjust thresholds/quorum under change-control.

### 3) Parameter misconfiguration
1. `pause()` for containment if needed.
2. Revert parameter to known-safe value.
3. Re-run verification scripts.
4. Resume with documented post-incident report.

### 4) Treasury / solvency alarm
1. Immediately halt withdrawals.
2. `pause()` while triaging.
3. Reconcile locked totals against event history.
4. Resume only after deterministic reconciliation.

## Safe pausing and resume procedure
```mermaid
flowchart TD
  A[Detect incident] --> B{Need full containment?}
  B -->|Yes| C[pause + setSettlementPaused(true)]
  B -->|No| D[pause only]
  C --> E[Diagnose + remediate]
  D --> E
  E --> F[setSettlementPaused(false)]
  F --> G[unpause]
```

## Key management / ownership transfer
- Prefer multisig as owner.
- Rotate operators by updating moderator lists and runbook access.
- Ownership transfer sequence:
  1. pre-announce maintenance window,
  2. `transferOwnership(<NEW_OWNER>)`,
  3. verify owner on-chain,
  4. run pause/unpause sanity check.

## Gotchas / failure modes
- `settlementPaused=true` blocks critical settlement routes; avoid prolonged use.
- Paused state is required for `withdrawAGI`, but this should be operationally rare and logged.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`./DEPLOY_DAY_RUNBOOK.md`](./DEPLOY_DAY_RUNBOOK.md)
- [`./CONFIGURATION_REFERENCE.md`](./CONFIGURATION_REFERENCE.md)
