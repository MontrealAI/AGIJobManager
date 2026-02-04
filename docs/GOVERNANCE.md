# Minimal governance model

This document defines the **“configure once, then operate with minimal governance”** posture for AGIJobManager deployments.

## Governance roles

| Role | Purpose | Operational expectation |
| --- | --- | --- |
| **Owner (multisig/timelock)** | Emergency control + parameter stewardship. | Use a production multisig (or timelock) and treat actions as exceptional. |
| **Moderators** | Resolve disputes with typed outcomes. | Keep the set small (1–3) and enforce a written runbook. |
| **Validators / Agents** | Day‑to‑day market participants. | Prefer Merkle roots + ENS ownership checks; use explicit allowlists only for recovery. |

## Minimal governance principles

1. **Set parameters once** (constructor + post‑deploy config) and avoid frequent changes.
2. **Publish runbooks** for any owner‑level action (who, why, and on‑chain hash).
3. **Use incident playbooks** for pause/unpause and stale dispute recovery.
4. **Avoid governance creep**: don’t add new privileged surfaces unless required for security.

## Emergency controls policy

Use emergency controls only for incidents or recovery; keep an audit log.

- **Pause / unpause** (`pause`, `unpause`)
  - Use for critical bugs, validator compromise, or systemic fraud.
  - Keep pauses short and documented; unpause only after remediation.
- **Resolve stale disputes** (`resolveStaleDispute`)
  - Requires the contract to be paused.
  - Use when disputes exceed the review period and moderator action is unavailable.
- **Withdraw non‑escrow funds** (`withdrawAGI`)
  - Only while paused.
  - Never withdraw if it would dip below `lockedEscrow`.

## Day‑to‑day operations (low‑touch)

- Monitor core events (`JobCreated`, `JobCompleted`, `DisputeResolvedWithCode`, etc.).
- Keep validator allowlists stable; update Merkle roots via `updateMerkleRoots` only with change control and published allowlist artifacts.
- Avoid changing payout parameters post‑launch unless absolutely necessary.

## Documentation & record‑keeping

- Maintain a **governance log** (tx hash, signers, reason, rollback plan).
- Record **ownership transfers** and multisig thresholds in deployment records.
- Keep **incident post‑mortems** and link them from ops docs.
