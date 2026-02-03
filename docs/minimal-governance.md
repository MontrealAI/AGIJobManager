# Minimal governance model

This document explains the **critical configuration lock** and the intended “configure once → operate” posture.

## What the configuration lock does

Calling `lockConfiguration()` permanently disables **critical configuration setters**. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, but the **critical config surface** is frozen.

## Functions disabled after lock

These functions are guarded by `whenCriticalConfigurable` and **revert** once the configuration is locked:

**Critical routing / identity**
- `updateAGITokenAddress` (only allowed before any job exists and before the lock)
- `updateENSRegistry` (only allowed before any job exists and before the lock)
- `updateNameWrapper` (only allowed before any job exists and before the lock)
- `updateRootNodes` (only allowed before any job exists and before the lock)

> **Note:** These setters also require `nextJobId == 0` and `lockedEscrow == 0` to prevent rewiring after jobs exist.

## Functions still available after lock

These are considered **break-glass** or operational safety controls and remain available after the lock:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.
- `withdrawAGI()` — surplus withdrawals while paused (escrow is always reserved).
- `updateMerkleRoots()` — allowlist membership updates (access control only).

Other configuration knobs (thresholds, review periods, allowlists, metadata, etc.) remain **tunable** after lock because they are not part of the critical configuration surface.

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
