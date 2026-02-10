# Security Model (Repository-specific)

## Threat model summary

This system is intentionally **business-operated**. It is not a trustless court.

- Owner has privileged controls (configuration, pause, allowlists, treasury withdrawal under constraints).
- Moderators resolve disputes.
- Validators are permissioned by ENS/Merkle/allowlist checks.

## Critical risks and mitigations

| Risk | Description | Mitigations in code |
|---|---|---|
| ERC-20 transfer failure | Token may return false/revert/no-return | `TransferUtils` wrappers and explicit revert on failed transfers |
| External ENS hook failures | ENS side effects may fail | Best-effort hook call + `EnsHookAttempted`; core settlement is independent |
| Escrow insolvency | Owner or bad logic could drain escrow | `withdrawableAGI` subtracts locked escrow and all bond buckets; `withdrawAGI` checked |
| Settlement deadlock | Emergency conditions can block completion | `resolveStaleDispute`, pause controls, explicit review windows |
| Role compromise | Owner/moderator key loss or abuse | Operational controls: multisig owner, key hygiene, event monitoring |

## Pause semantics

- `paused` (OpenZeppelin `Pausable`) blocks most active flows.
- `settlementPaused` independently gates settlement-sensitive paths.
- `withdrawAGI` requires **paused=true** and **settlementPaused=false**.

## Role compromise scenarios

- **Owner compromise**: attacker can reconfigure policy, alter role lists, pause/unpause, or withdraw treasury surplus.
- **Moderator compromise**: attacker can resolve disputed jobs in favored direction.

Recommended operational model:
- owner = multisig
- limited moderator set with explicit approval policy
- emergency playbooks for pause + key rotation

## Monitoring recommendations

Monitor and alert on:
- `SettlementPauseSet`, `Paused`, `Unpaused`
- `DisputeResolvedWithCode`, `resolveStaleDispute` transactions
- `AGIWithdrawn`
- role changes (moderators, allowlists, blacklists)
- `EnsHookAttempted` failures

## Security process

This document supplements, not replaces, repository `SECURITY.md` reporting guidance.
