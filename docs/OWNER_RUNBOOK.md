# OWNER_RUNBOOK

This runbook is optimized for low-touch operations with Etherscan + offline scripts.

## 1) Deployment and verification checklist

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

## 3) Operating modes

| Mode | Pause setting | Settlement setting | Typical use |
|---|---|---|---|
| Normal operation | `paused=false` | `settlementPaused=false` | standard intake + settlement |
| Intake stopped | `pause()` | unchanged | freeze new jobs/applications while allowing existing settlement |
| Settlement stopped | unchanged | `setSettlementPaused(true)` | preserve evidence/state while stopping finalize/dispute writes |
| Full incident response | `pauseAll()` | `pauseAll()` | severe incidents requiring full freeze |

## 4) Standard procedures

### A) Rotating allowlists safely
1. Build candidate address list offline.
2. Generate root/proofs offline:
   ```bash
   node scripts/merkle/export_merkle_proofs.js --input addresses.json --output proofs.json
   ```
3. Validate output format (proof arrays paste directly into Etherscan).
4. Publish migration notice with effective timestamp.
5. Call `updateMerkleRoots(validatorRoot, agentRoot)`.
6. Distribute new proofs to affected users.

### B) Adding/removing moderators
1. Open internal ticket and capture reason.
2. Execute `addModerator(address)` or `removeModerator(address)`.
3. Read-check moderator status and archive tx hash.

### C) Blacklisting policy and reversal
1. Collect objective evidence and ticket.
2. Execute `blacklistAgent` or `blacklistValidator` only for concrete abuse/risk.
3. Communicate reason + review path.
4. Reverse via corresponding unblacklist flow once risk is resolved.

### D) Safe platform withdrawals
Always perform in this order:
1. Read `withdrawableAGI()`.
2. Confirm requested `amount <= withdrawableAGI()`.
3. Confirm no active incident requiring additional buffer.
4. Call `withdrawAGI(amount)`.
5. Archive tx hash and rationale.

Never rely on raw ERC20 balance as withdrawable value; escrow and bonds must remain solvent.

## 5) ENS and identity controls

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

## 6) High-risk actions (dual-review required)

Require explicit change ticket + rollback note before execution:
- `rescueERC20`
- `rescueToken`
- `lockIdentityConfiguration`
- identity setters listed above
- major economics setters (thresholds, bond amounts, timing windows)

## 7) Incident decision table

| Symptom | Checks | Action | Rollback |
|---|---|---|---|
| unexpected create/apply failures | `paused()`, allowance, balances | if protocol issue: `pause()` | `unpause()` after fix + notice |
| finalize/dispute failing globally | `settlementPaused`, review windows, config writes | `setSettlementPaused(true)` while triaging | `setSettlementPaused(false)` |
| suspicious admin key activity | signer audit + pending tx review | `pauseAll()` and rotate ops keys | `unpauseAll()` after key hygiene |
| solvency concern | `withdrawableAGI()`, escrow obligations | stop withdrawals, investigate accounting | resume withdrawals only after margin restored |

## 8) Offline helper tooling for autonomous ops

- Etherscan parameter prep: `node scripts/etherscan/prepare_inputs.js --action <...>`
- Merkle root/proofs: `node scripts/merkle/export_merkle_proofs.js ...`
- State decision aid: `node scripts/advisor/state_advisor.js --input <state.json>`
