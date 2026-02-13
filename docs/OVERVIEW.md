# Overview

AGIJobManager is an owner-operated escrow and settlement protocol for employer-agent jobs with validator voting and moderator dispute resolution.

## Repository guarantees

1. Escrow solvency accounting is explicit (`lockedEscrow`, bond locks, `withdrawableAGI`).
2. Operator controls are explicit and role-scoped (`pause`, `settlementPaused`, blacklist controls).
3. ENS and ENSJobPages are best-effort integrations; they are not safety dependencies.

## Components

| Component | Responsibility | Source of truth |
| --- | --- | --- |
| AGIJobManager contract | Job lifecycle, escrow, bonds, governance controls | `contracts/AGIJobManager.sol` |
| ENS helpers | Ownership checks and optional metadata/hook routing | `contracts/utils/ENSOwnership.sol`, `contracts/ens/ENSJobPages.sol` |
| Deployment wiring | Deterministic deployment and configuration | `migrations/2_deploy_contracts.js`, `scripts/postdeploy-config.js` |
| Test harness | Regression, hardening, invariants | `test/*.test.js` |

> **Non-goal / limitation**
> This system is not a decentralized court; owner and moderators are privileged actors by design.
