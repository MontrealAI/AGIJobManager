# Troubleshooting

## Custom errors

| Error | Meaning | Typical remediation |
|---|---|---|
| `NotModerator` | Caller is not in `moderators` mapping | Use owner to add moderator or call from moderator |
| `NotAuthorized` | ENS/Merkle/allowlist checks failed | Verify subdomain/root/proof/allowlist inputs |
| `Blacklisted` | Agent or validator is blocked | Remove blacklist entry if policy allows |
| `InvalidParameters` | Input outside allowed bounds | Validate payload, thresholds, percentages, addresses |
| `InvalidState` | Action not valid in current lifecycle state | Query `getJobCore`/`getJobValidation` and retry correct path |
| `JobNotFound` | Invalid `jobId` | Use `JobCreated` event jobId |
| `TransferFailed` | ERC-20 transfer failure/under-delivery | Check balance, allowance, token behavior |
| `ValidatorLimitReached` | Validator cap reached for job | Increase config policy for future jobs (within cap) |
| `InvalidValidatorThresholds` | approval/disapproval values violate combined cap | Reconfigure thresholds coherently |
| `IneligibleAgentPayout` | Agent has no valid payout tier | Add AGI type or allowlist/identity that yields payout percent |
| `InsufficientWithdrawableBalance` | owner requested too much treasury withdrawal | Recompute `withdrawableAGI` and lower amount |
| `InsolventEscrowBalance` | token balance below locked obligations | Investigate token transfer failures or accounting incidents |
| `ConfigLocked` | identity config already locked | Redeploy if identity rewiring is required |
| `SettlementPaused` | settlement pause gate active | Owner should clear `settlementPaused` when safe |
| `DeprecatedParameter` | deprecated setter called | Do not use deprecated function |

## Runbook snippets

### Pause / unpause

- Emergency freeze: `pause()` (owner).
- Resume normal flows: `unpause()` (owner).
- If settlement-specific hold needed: `setSettlementPaused(true)`.

### Dispute resolution

- Moderator path: `resolveDisputeWithCode(jobId, code, reason)`.
- Owner stale path: `resolveStaleDispute(jobId, employerWins)` after `disputeReviewPeriod`.

### Blacklisting controls

- `blacklistAgent(address,bool)`
- `blacklistValidator(address,bool)`

### Misconfiguration recovery

- Disable ENS hooks quickly: `setEnsJobPages(address(0))`.
- Rotate Merkle roots live: `updateMerkleRoots(...)`.
- Token/ENS/root rewiring only if identity not locked and escrow is empty.

## Common operational checks

1. Confirm pause flags (`paused`, `settlementPaused`).
2. Confirm job state via getters:
   - `getJobCore`
   - `getJobValidation`
   - `getJobAccounting`
3. Confirm eligibility inputs (subdomain + Merkle proof).
4. Confirm token allowance and balances for payer accounts.
