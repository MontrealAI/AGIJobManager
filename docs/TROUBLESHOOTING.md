# Troubleshooting

## Common operational issues

| Symptom | Typical cause | Fix |
|---|---|---|
| `createJob` reverts | payout/duration exceeds limits or bad URI or token transfer failure | Verify `maxJobPayout`, `jobDurationLimit`, URI format, allowance/balance |
| `applyForJob` reverts | agent unauthorized/blacklisted/no payout tier/max active jobs hit | Verify ENS/Merkle/additional lists, blacklist flags, AGI type eligibility |
| `validateJob`/`disapproveJob` reverts | completion not requested, vote window closed, duplicate vote, unauthorized validator | Check `completionRequestedAt`, review period, prior vote flags, gating proofs |
| `finalizeJob` reverts | called before challenge/review window or while disputed | Re-evaluate timing and dispute status |
| `withdrawAGI` reverts | not paused, settlement paused, amount > withdrawable, insolvency | pause contract, ensure settlement not paused, re-check locked totals |
| ENS hooks failing | ENSJobPages misconfigured or reverts | check `EnsHookAttempted` events and ENSJobPages configuration |

## Runbook snippets

### Pause / unpause
1. Owner calls `pause()` for emergency stop.
2. Investigate and resolve issue.
3. Owner calls `unpause()` when safe.

### Settlement pause toggle
- Use `setSettlementPaused(true)` to freeze settlement-sensitive operations independently.
- Restore with `setSettlementPaused(false)` after remediation.

### Dispute intervention
- Moderator uses `resolveDisputeWithCode(jobId, 1|2, reason)`.
- If stale beyond dispute window, owner can use `resolveStaleDispute(jobId, employerWins)`.

### Blacklist action
- `blacklistAgent(address, bool)` or `blacklistValidator(address, bool)` by owner.
- Document reason and expiration policy off-chain.

## Custom errors map

| Error | Meaning | Typical remediation |
|---|---|---|
| `NotModerator` | caller not in moderator set | add moderator or use correct account |
| `NotAuthorized` | caller failed role/ownership check | verify role, ENS/Merkle proof, and caller identity |
| `Blacklisted` | address currently blacklisted | remove from blacklist if appropriate |
| `InvalidParameters` | invalid input/parameter combination | validate bounds and non-empty/valid URI constraints |
| `InvalidState` | call not valid in current job/contract state | inspect job flags and required transitions |
| `JobNotFound` | nonexistent job ID | query existing job range (`nextJobId`) |
| `TransferFailed` | ERC20 transfer or transferFrom failed | verify token behavior, approvals, and balances |
| `ValidatorLimitReached` | max validators per job exceeded | avoid extra validator vote attempts |
| `InvalidValidatorThresholds` | approvals/disapprovals config invalid | adjust thresholds within `MAX_VALIDATORS_PER_JOB` |
| `IneligibleAgentPayout` | agent has no positive AGI payout tier | add/enable AGI type holdings with non-zero payout tier |
| `InsufficientWithdrawableBalance` | withdraw exceeds treasury surplus | reduce withdrawal amount or settle obligations |
| `InsolventEscrowBalance` | token balance below locked totals | investigate token outflow anomaly immediately |
| `ConfigLocked` | identity config locked | cannot update identity wiring after lock |
| `SettlementPaused` | settlement pause guard active | unset settlement pause for those functions |
| `DeprecatedParameter` | legacy setter disabled | do not use deprecated parameter path |
