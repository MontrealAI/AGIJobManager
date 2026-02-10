# Troubleshooting

## Common issues and fixes

| Symptom | Typical cause | Verification | Remediation |
|---|---|---|---|
| `createJob` reverts | invalid payout/duration or ERC20 transfer failure | check `maxJobPayout`, `jobDurationLimit`, allowance/balance | fix params and token approval |
| `applyForJob` reverts | unauthorized identity, blacklist, payout tier 0, active job cap | inspect allowlists/roots/proofs, blacklist mappings, AGI types, active jobs | authorize identity, remove blacklist, configure AGI type, wait for slot release |
| `requestJobCompletion` reverts | caller not assigned agent, empty URI, invalid state/time | check `assignedAgent`, URI, completion status/timestamps | call from assigned agent with valid URI and timing |
| `validateJob`/`disapproveJob` reverts | voting outside review window, duplicate vote, unauthorized validator | check completion timestamp, proof path, prior vote state | vote within review period with valid authorization |
| `finalizeJob` reverts | too early (challenge/review window) or invalid state | inspect completion/vote timestamps and dispute flag | wait window or resolve dispute path |
| `withdrawAGI` reverts | paused condition not met, settlement paused, or insufficient withdrawable | check `paused()`, `settlementPaused`, `withdrawableAGI()` | set correct pause flags and requested amount |

## Runbook snippets

### Pause / unpause
- Owner calls `pause()` to stop `whenNotPaused` actions.
- Owner calls `unpause()` to resume.
- Owner may separately call `setSettlementPaused(true|false)` for settlement-sensitive controls.

### Resolve disputes
- Moderator: `resolveDisputeWithCode(jobId, 1|2, reason)`.
- Owner stale path after timeout: `resolveStaleDispute(jobId, employerWins)`.

### Blacklisting
- Owner: `blacklistAgent(agent, true|false)`.
- Owner: `blacklistValidator(validator, true|false)`.

### Misconfiguration recovery
- Before identity lock and with empty obligations, owner may update token/ENS/namewrapper/root wiring.
- After lock or with active obligations, redeployment is the safe path for identity wiring mistakes.

## Custom errors reference

| Custom error | Meaning | Typical remediation |
|---|---|---|
| `NotModerator` | caller is not an approved moderator | add moderator or call from moderator account |
| `NotAuthorized` | role/identity gate failed | provide valid allowlist/proof/subdomain ownership or correct caller |
| `Blacklisted` | account denied by blacklist | owner removes blacklist entry if appropriate |
| `InvalidParameters` | input value failed constraints | inspect bounds/zero-address checks and retry |
| `InvalidState` | call not valid in current job/contract state | check lifecycle stage and timing windows |
| `JobNotFound` | invalid job id | use existing job id |
| `TransferFailed` | token transfer helper failed | verify token behavior, allowance, balances |
| `ValidatorLimitReached` | max validators per job reached | stop adding validator votes |
| `InvalidValidatorThresholds` | threshold params exceed cap/combined limits | set compliant thresholds |
| `IneligibleAgentPayout` | agent has no eligible AGI type payout tier | configure AGI types or eligibility NFTs |
| `InsufficientWithdrawableBalance` | withdrawal exceeds treasury surplus | lower amount or release obligations first |
| `InsolventEscrowBalance` | on-chain token balance below locked liabilities | halt operations and investigate accounting discrepancy |
| `ConfigLocked` | identity config was permanently locked | redeploy for identity rewiring |
| `SettlementPaused` | settlement pause flag blocks action | owner sets `setSettlementPaused(false)` if safe |
| `DeprecatedParameter` | deprecated setter called | do not use deprecated function |
