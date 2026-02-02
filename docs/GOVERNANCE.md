# Minimal Governance Model (AGIJobManager)

This document defines a **configure once, then operate with minimal governance** posture for AGIJobManager. It is meant for long‑term operators who want predictable operations with only rare owner actions.

## Governance roles

- **Owner (multisig or timelock)**
  - Holds emergency controls (`pause`, `unpause`, `resolveStaleDispute`, `withdrawAGI`).
  - Owns the only privileged configuration surface.
  - Should be a multisig with clear signing policy and change management.

- **Moderators (small set)**
  - Resolve disputes via `resolveDisputeWithCode`.
  - Should be a small, trusted set (1–3) with explicit documentation for each decision.

- **Operational staff (non‑owners)**
  - Monitor events, run read‑only checks, and prepare configuration runs.
  - Should not hold owner keys.

## Minimal governance principles

1. **Configure once**: set parameters immediately after deploy using a single scripted run.
2. **Keep changes rare**: any owner‑level change requires a written runbook and signoff.
3. **Prefer immutable inputs**: constructor inputs (token, ENS, roots, Merkle roots) should never change post‑deploy.
4. **Avoid allowlist churn**: use ENS + Merkle proofs as the primary gating mechanism; explicit allowlists only for exceptions.

## Emergency controls policy

- **Pause** when:
  - A critical bug is discovered.
  - A dispute is stuck and needs owner recovery.
  - An external dependency (ENS/NameWrapper) is behaving unexpectedly.

- **Resolve stale disputes** only while paused, only after the review period, and only with a documented incident report.

- **WithdrawAGI** is reserved for removing surplus (non‑escrow) balances during emergency or migration operations.

## Ownership transfer (final owner)

After the post‑deploy configuration run:

1. Verify all configuration values (read‑only checks).
2. Unpause if the launch checklist is complete.
3. Transfer ownership to the long‑term multisig/timelock.

The multisig should be the only owner in production. Avoid retaining deployer keys.

## Day‑to‑day operations

- Monitor contract events for job lifecycle, disputes, and escrow health.
- Use `scripts/verify-config.js` for periodic read‑only checks.
- Avoid changing parameters unless there is a documented policy reason.

For the configure‑once runbook and parameter guidance, see [`docs/CONFIGURE_ONCE.md`](CONFIGURE_ONCE.md).
