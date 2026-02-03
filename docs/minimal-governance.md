# Minimal governance model

This document explains the **configuration lock** and the intended “configure once → operate” posture.

## What the configuration lock does

Calling `lockConfiguration()` permanently disables **critical configuration** changes. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, but governance surface is minimized.

## Functions disabled after lock

Only **critical configuration** setters are disabled after lock; other operational parameters remain adjustable to preserve owner flexibility.

- **Token routing**: `updateAGITokenAddress` (guarded to only allow changes before any job/escrow exists).
- **ENS wiring / root nodes**: if a future build exposes setters for ENS registry, NameWrapper, or root nodes, they must be gated by the same lock.

## Functions still available after lock

These are considered **break-glass** or operational safety controls, and remain callable after lock:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.
- `withdrawAGI()` — **surplus-only** withdrawals (`balance - lockedEscrow`), owner-only, paused, nonReentrant.

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
