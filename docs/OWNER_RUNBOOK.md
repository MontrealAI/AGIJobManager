# OWNER_RUNBOOK

This runbook is optimized for low-touch operations with Etherscan + offline scripts.

## 1) Deployment checklist

1. Build with repo defaults:
   ```bash
   npm ci
   npm run build
   npm run size
   ```
2. Confirm external libraries are deployed and linked as intended.
3. Deploy AGIJobManager.
4. Verify source on Etherscan using exact compiler settings and library mappings (see [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md)).
5. Post-deploy, read-check critical config values on Etherscan (`token`, review windows, quorum, thresholds, bond amounts).
6. Record deployment metadata (addresses, tx hashes, compiler settings, linked library addresses).

## 2) Recommended safe defaults + staged rollout

- Stage 0 (dry run): keep intake paused while verification + docs + proofs are checked.
- Stage 1 (limited pilot): unpause intake, keep settlement open, use small payouts and short durations.
- Stage 2 (scale): increase limits only after successful pilot dispute/finalization outcomes.
- Keep Merkle roots and allowlists small and auditable at first.

## 3) Incident playbooks

### Operating modes (choose explicitly)

| Mode | Intake (`paused`) | Settlement (`settlementPaused`) | When to use |
|---|---:|---:|---|
| Normal operation | `false` | `false` | Default production mode |
| Intake stopped | `true` | `false` | Block new jobs/applications while allowing existing jobs to settle |
| Settlement stopped | `false` | `true` | Freeze settlement-gated actions (including create/apply/finalize/dispute) while investigating |
| Full incident response | `true` | `true` | Suspected severe bug/exploit or unresolved accounting risk |

Execution mapping:
- Normal operation: `unpauseAll()` (or `unpause()` + `setSettlementPaused(false)`)
- Intake stopped: `pause()`
- Settlement stopped: `setSettlementPaused(true)`
- Full incident response: `pauseAll()`

### A) Stop intake only (new jobs/applications)
Recommended sequence:
1. `pause()`
2. Announce incident status and impact.
3. Keep settlement open unless actively unsafe.

### B) Stop settlement only (finalize/dispute lane)
Recommended sequence:
1. `setSettlementPaused(true)`
2. Keep intake setting unchanged if desired.
3. Announce expected recovery timeline.

### C) Full stop
Recommended sequence:
1. `pauseAll()`
2. Validate both `paused()==true` and `settlementPaused()==true`.
3. Announce freeze scope and next update time.

### D) Resume
- Intake only: `unpause()`
- Settlement only: `setSettlementPaused(false)`
- Full resume: `unpauseAll()`

## 4) Incident decision table (symptom → checks → action → rollback)

| Symptom | Immediate checks | Primary action | Rollback / exit criteria |
|---|---|---|---|
| Reverts on create/apply spike | `paused()`, `settlementPaused()`, token allowance/balance, recent config changes | If uncertain, move to **Intake stopped** (`pause()`) while triaging | `unpause()` only after reproducer resolved and docs/support messaging updated |
| Finalize/dispute path behaving unexpectedly | `settlementPaused()`, `getJobCore`, `getJobValidation`, timing parameters | Move to **Settlement stopped** (`setSettlementPaused(true)`) while moderators/owner review | `setSettlementPaused(false)` after confirming expected behavior on sampled jobs |
| Suspected exploit or accounting inconsistency | Contract AGI balance, `withdrawableAGI()`, active disputes/jobs | Move to **Full incident response** (`pauseAll()`) | `unpauseAll()` only after root cause and compensating controls are documented |
| Authorization complaints (legit users blocked) | Merkle roots, additional allowlists, ENS root config, blacklist state | Keep mode as-is, rotate roots/allowlist with change notice | Confirm affected users can apply/vote with new proofs and archive evidence |
| Moderator capacity backlog | count of `disputed==true` jobs and age vs `disputeReviewPeriod` | Add moderators (`addModerator`) and use standardized reason format | Remove temporary moderators when backlog clears |

## 5) Safe revenue withdrawals (solvency-first)

Always perform in this order:
1. Read `withdrawableAGI()`.
2. Confirm requested `amount <= withdrawableAGI()`.
3. Confirm no active incident requiring additional buffer.
4. Call `withdrawAGI(amount)`.
5. Archive tx hash and rationale.

Never rely on raw ERC20 balance as withdrawable value; escrow and bonds must remain solvent.

## 6) Allowlist governance and Merkle root rotation

1. Build candidate address list offline.
2. Generate root/proofs offline:
   ```bash
   node scripts/merkle/export_merkle_proofs.js --input addresses.json --output proofs.json
   ```
3. Validate output format (proof arrays paste directly into Etherscan).
4. Publish migration notice with effective timestamp.
5. Call `updateMerkleRoots(validatorRoot, agentRoot)`.
6. Distribute new proofs to affected users.

## 7) ENS operations

Identity/ENS configuration functions:
- `setEnsJobPages`
- `setUseEnsJobTokenURI`
- `updateEnsRegistry`
- `updateNameWrapper`
- `updateRootNodes`
- `updateMerkleRoots`

Guidelines:
- Enable ENS tokenURI (`setUseEnsJobTokenURI(true)`) only after end-to-end testing.
- Treat root-node changes as high-risk; coordinate with moderators and support.
- `lockIdentityConfiguration()` is irreversible. Use only when sure ENS/Merkle configuration is final.

## 8) High-risk actions (dual-review required)

Require explicit change ticket + rollback note before execution:
- `rescueERC20`
- `rescueToken`
- `lockIdentityConfiguration`
- identity setters listed above
- major economics setters (thresholds, bond amounts, timing windows)

## 9) Offline helper tooling for autonomous ops

- Etherscan parameter prep: `node scripts/etherscan/prepare_inputs.js --action <...>`
- Merkle root/proofs: `node scripts/merkle/export_merkle_proofs.js ...`
- State decision aid: `node scripts/advisor/state_advisor.js --input <state.json>`
