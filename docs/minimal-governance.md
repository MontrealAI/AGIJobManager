# Minimal governance model

This document explains the **configuration lock** and the intended “configure once → operate” posture.

## What the configuration lock does

Calling `lockConfiguration()` permanently disables only the **critical configuration surface**. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, but critical identity/funds wiring cannot be changed.

## Functions disabled after lock

The lock guards only critical configuration. In this implementation, the following is disabled after lock:

- `updateAGITokenAddress` (critical funds routing)

> **Note:** ENS registry, NameWrapper, and root nodes are set in the constructor and are **not** changeable after deployment in this implementation. If setters are added later, they must be guarded by the lock.

`updateAGITokenAddress` is also constrained to run only **before any job exists** and **before any escrow can exist** (`nextJobId == 0` and `lockedEscrow == 0`) to prevent catastrophic misconfiguration.

## Functions still available after lock

These are considered **break-glass** or operational safety controls:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.
- `withdrawAGI()` — owner-only withdrawals of **surplus funds** (balance minus locked escrow), **only while paused**.

All other tunable governance parameters (thresholds, periods, metadata, allowlists) remain available to preserve operational flexibility.

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
