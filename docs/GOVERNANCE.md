# Minimal governance model — v0.9.3

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

- **Intake pause** (`pause` / `pauseIntake`) stops new postings and assignments; it does not freeze existing completion, voting or settlement.
- **Settlement pause** (`setSettlementPaused(true)`) blocks completion, votes, disputes and settlement as well as intake. Use `pauseAll()` when both lanes need containment.
  - Follow the [incident procedures](OPERATIONS/INCIDENT_RESPONSE.md); document the affected paths and restore them after remediation.
- **Resolve stale disputes** (`resolveStaleDispute`)
  - Owner-only, with settlement enabled and time strictly after `disputedAt + disputeReviewPeriod`; intake pause is not required.
  - Use when disputes exceed the review period and moderator action is unavailable.
- **Withdraw unreserved USDC** (`withdrawUSDC`)
  - Requires intake paused and settlement enabled.
  - Use `withdrawableUSDC()`, which protects `lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`. The total token balance is not the withdrawable amount.

## Day‑to‑day operations (low‑touch)

- Monitor core events (`JobCreated`, `JobCompleted`, `DisputeResolvedWithCode`, etc.).
- Keep validator allowlists stable; update Merkle roots via `updateMerkleRoots` only with change control and published allowlist artifacts.
- Preserve posted-job economics: validator rates are fixed at posting, agent bonds at assignment, and validator bonds at first vote. Thresholds, timers and slashing require empty reserves before changes.
- The token and 30%/10% shares are fixed. Rotating recipients requires intake paused and every reserve zero; see [owner controls](OWNER_CONTROLS.md).

## Documentation & record‑keeping

- Maintain a **governance log** (tx hash, signers, reason, rollback plan).
- Record **ownership transfers** and multisig thresholds. A transfer proposal does not change authority until the proposed owner calls `acceptOwnership`; verify both `owner()` and `pendingOwner()`.
- Keep **incident post‑mortems** and link them from ops docs.
