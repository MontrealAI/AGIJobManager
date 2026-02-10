# Repository-Specific Security Model

## Threat model summary

AGIJobManager is a **business-operated, owner-privileged escrow protocol**. It is not a trustless court. Critical assumptions:
- Owner and moderators are trusted operators.
- Validator set is permissioned by ENS/Merkle/allowlists.
- ERC20 token behavior is standard enough for exact-transfer wrappers.

## Critical risks and mitigations

| Risk | Impact | In-code mitigation | Operational mitigation |
|---|---|---|---|
| Owner key compromise | Config abuse, pause abuse, allowlist tampering | Role checks only | Use multisig + hardware keys + restricted signer policy |
| Moderator compromise | Dispute outcomes manipulated | `onlyModerator`, typed resolution paths | Keep moderator set minimal; monitor resolution events |
| ERC20 transfer anomalies | Settlement/withdraw revert or unexpected behavior | `TransferUtils.safeTransfer*` and exact transfer checks | Use vetted token contracts; run smoke tests before production |
| ENS hook failure | Metadata/permissions drift | Best-effort calls + event visibility | Alert on `EnsHookAttempted(false)` and reconcile manually |
| Misconfigured parameters | Economic imbalance, poor liveness | Input guards and invariant checks | Use staged testnet rollout and parameter review gates |
| Insolvency state | Treasury withdraw blocked | `withdrawableAGI()` reverts on insolvent balance | Monitor locked totals vs token balance continuously |

## Pause and settlement pause semantics

- `pause()` (`whenNotPaused`) blocks create/apply/vote/dispute and reward-pool contributions.
- `requestJobCompletion` is intentionally callable while paused (dispute/liveness recovery).
- `settlementPaused` blocks settlement-sensitive methods using custom guard (`whenSettlementNotPaused`), including finalize/dispute resolution/withdraw/cancel/expire.
- `withdrawAGI` requires paused mode **and** settlement not paused.

## Role-compromise scenarios

### Owner compromised
Immediate actions:
1. Pause contract.
2. Freeze off-chain integrations.
3. Rotate owner to secured multisig if possible.
4. Audit recent config and allowlist changes from events.

### Moderator compromised
Immediate actions:
1. Owner removes compromised moderator.
2. Pause if active disputes are at risk.
3. Reassign trusted moderator(s) and document incident.

## Operational security recommendations

- Use a multisig as owner from day one.
- Separate deployer and operator keys.
- Keep moderator key custody independent from owner signers.
- Maintain alerts for:
  - `SettlementPauseSet`, `Paused`, `Unpaused`
  - config update events
  - `DisputeResolved*`, `JobDisputed`
  - `AGIWithdrawn`
  - `EnsHookAttempted(success=false)`
