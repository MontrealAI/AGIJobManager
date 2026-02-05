# Minimal governance model

This document explains the **identity wiring lock** and the intended “configure once → operate” posture.

## What the identity wiring lock does

Calling `lockIdentityConfiguration()` permanently disables **identity wiring setters**. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, but the **identity wiring surface** is frozen.

## Functions disabled after lock

These functions are guarded by `whenIdentityConfigurable` and **revert** once the identity wiring is locked:

**Identity wiring**
- `updateAGITokenAddress` (only allowed before any job exists and before the lock)
- `updateEnsRegistry` (only allowed before any job exists and before the lock)
- `updateNameWrapper` (only allowed before any job exists and before the lock)
- `updateRootNodes` (only allowed before any job exists and before the lock)

> **Note:** ENS registry, NameWrapper, and root node updates are intentionally limited to pre‑first‑job and pre‑lock windows to preserve identity safety.

## Functions still available after lock

These are considered **break-glass** or operational safety controls and remain available after the lock:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.
- `withdrawAGI()` — surplus withdrawals while paused (escrow is always reserved).

Other configuration knobs (thresholds, review periods, allowlists, metadata, etc.) remain **tunable** after lock because they are not part of the identity wiring surface.

**Allowlists remain mutable after lock**:
- `updateMerkleRoots` stays available post-lock so validator/agent allowlists can evolve.

> **Note:** `transferOwnership` remains available via `Ownable`. Operators should decide whether to transfer ownership to a long-lived multisig or leave ownership unchanged after lock.

## Recommended operational sequence

1. **Deploy** (set ENS/NameWrapper/token/root nodes and Merkle roots).
2. **Configure** (thresholds, payouts, metadata, moderators, allowlists).
3. **Validate** (run sanity checks and real job flow).
4. **Lock** (`lockIdentityConfiguration()` or `LOCK_IDENTITY_CONFIG=true` during migration).
5. **Operate** (minimal governance with incident-response tools only).

## Monitoring suggestions (post-lock)

To keep operations low-touch, monitor the following invariants and events:

- **Escrow solvency**: track `lockedEscrow + lockedAgentBonds + lockedValidatorBonds` vs. token balance; `withdrawableAGI()` must stay non‑negative.
- **Identity wiring changes (pre-lock)**: watch `EnsRegistryUpdated`, `NameWrapperUpdated`, `RootNodesUpdated`, and `IdentityConfigurationLocked`.
- **Allowlist updates**: `MerkleRootsUpdated` signals validator/agent allowlist changes (access only, not payout logic).
- **Dispute recovery**: `DisputeTimeoutResolved` indicates break‑glass resolution by the owner.

## Notes for Sepolia/local/private deployments

- Keep **ENS registry** and **NameWrapper** addresses configurable (`AGI_ENS_REGISTRY`, `AGI_NAMEWRAPPER`).
- Override the AGI token address for non-mainnet networks (`AGI_TOKEN_ADDRESS`).
- Root nodes and Merkle roots should be set per environment.
