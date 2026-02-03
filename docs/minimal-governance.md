# Minimal governance model

This document explains the **configuration lock** and the intended “configure once → operate” posture.

## What the configuration lock does

Calling `lockConfiguration()` permanently disables **critical configuration** setters only. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, while preventing catastrophic misconfiguration of identity and fund routing.

## Functions disabled after lock

The lock applies **only** to the critical configuration surface:

- `updateAGITokenAddress` (ERC‑20 routing for escrow/payouts/withdrawals).

> **Note:** ENS registry, NameWrapper, and root nodes are constructor-only in this contract. If they become configurable in a future version, they must also be gated by the lock.

## Functions still available after lock

These are considered operational controls and remain available after lock:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.
- `withdrawAGI()` — owner-only, **paused**, and limited to **surplus** funds (`balance - lockedEscrow`).

Tunable parameters (thresholds, timeouts, allowlists, metadata) remain adjustable post-lock unless they affect critical identity or fund routing.

> **Note:** `transferOwnership` remains available via `Ownable`. Operators should decide whether to transfer ownership to a long-lived multisig or leave ownership unchanged after lock.

## Recommended operational sequence

1. **Deploy** (set ENS/NameWrapper/token/root nodes and Merkle roots).
2. **Configure** (thresholds, payouts, metadata, moderators, allowlists).
3. **Validate** (run sanity checks and real job flow).
4. **Lock** (`lockConfiguration()` or `LOCK_CONFIG=true` during migration).
5. **Operate** (minimal governance with incident-response tools only).

## Notes for Sepolia/local/private deployments

- Keep **ENS registry** and **NameWrapper** addresses configurable (`AGI_ENS_REGISTRY`, `AGI_NAMEWRAPPER`).
- Override the AGI token address for non-mainnet networks (`AGI_TOKEN_ADDRESS`).
- Root nodes and Merkle roots should be set per environment.
