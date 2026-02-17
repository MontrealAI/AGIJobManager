# OWNER_RUNBOOK

Low-touch operator guide for AGIJobManager.

## 1) Deployment checklist (including external libs + verification)

1. Build exactly with repo defaults (`npm ci`, `npm run build`).
2. Deploy/link external libraries exactly as deployment scripts expect.
3. Record deployed addresses for AGIJobManager and linked libraries.
4. Verify on Etherscan using the exact compiler/optimizer settings in [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md).
5. Confirm Etherscan shows readable `Read Contract` and `Write Contract` tabs.
6. Run post-deploy smoke checks:
   - `paused() == false` (unless launch freeze plan says otherwise)
   - `settlementPaused() == false`
   - correct token, ENS registry/wrapper/job pages addresses
   - root nodes + Merkle roots set as intended

## 2) Recommended safe defaults + staged rollout

### Stage 0 (dry-run)
- Keep intake paused.
- Configure roots, Merkle roots, moderators.
- Test end-to-end on a small controlled address set.

### Stage 1 (limited production)
- Unpause intake for a small allowlisted cohort.
- Keep conservative risk params (payout caps, duration limits, quorum thresholds).
- Monitor create/apply/completion/dispute path daily.

### Stage 2 (generalized)
- Expand allowlist scope or ENS routes.
- Increase limits gradually after observed stability.
- Keep incident playbooks ready and documented.

## 3) Incident playbooks (exact sequences)

### A) “Stop intake” only (new jobs/applications)
1. Call `pause()` (or `pauseIntake()`).
2. Keep `settlementPaused = false` so existing jobs can still settle.
3. Announce scope: no new intake, settlement still open.

### B) “Stop settlement” only
1. Call `setSettlementPaused(true)`.
2. Optionally keep intake open if incident is settlement-specific.
3. Announce affected functions (finalize/dispute/settle lanes).

### C) Full stop
1. Call `pauseAll()`.
2. Verify `paused() == true` and `settlementPaused() == true`.
3. Publish incident note with next review time.

### D) Controlled recovery
1. Reverse only the affected lane first (`setSettlementPaused(false)` or `unpause()`).
2. Observe before full reopen.
3. Restore fully with `unpauseAll()` when safe.

## 4) Safe treasury withdrawals without escrow risk

Never use raw token balance as withdrawable amount.

Checklist:
1. Read `withdrawableAGI()`.
2. Ensure planned amount is `<= withdrawableAGI()`.
3. Confirm incident state allows withdrawal (`whenPaused` and settlement not paused requirements apply to AGI path).
4. Execute `withdrawAGI(amount)`.
5. Archive tx hash and rationale.

## 5) Allowlist governance + Merkle root rotation

1. Prepare new address set offline.
2. Generate root/proofs offline:
   ```bash
   node scripts/merkle/export_merkle_proofs.js --input addresses.json --output proofs.json
   ```
3. Communicate cutover time + proof distribution instructions.
4. Call `updateMerkleRoots(newValidatorRoot, newAgentRoot)`.
5. Publish proofs as Etherscan-ready bytes32[] arrays.
6. Keep previous list/version for audit trail.

## 6) ENS operations

- Configure ENS integration addresses:
  - `updateEnsRegistry(address)`
  - `updateNameWrapper(address)`
  - `setEnsJobPages(address)`
- Configure roots:
  - `updateRootNodes(clubRoot, agentRoot, alphaClubRoot, alphaAgentRoot)`
- Toggle ENS tokenURI path:
  - `setUseEnsJobTokenURI(bool)`
- Permanent lock:
  - `lockIdentityConfiguration()` prevents further identity config mutation.

## 7) High-risk actions (change-control mandatory)

Require ticket + peer review + post-change validation:
- `rescueToken`, `rescueERC20`, `rescueETH`
- `lockIdentityConfiguration`
- identity setters (`updateEnsRegistry`, `updateNameWrapper`, `setEnsJobPages`, `updateRootNodes`, `updateMerkleRoots`)
- economic setters (bond/quorum/timing/limit parameters)

## 8) Minimal recurring ops cadence

Daily:
- review paused flags
- review unresolved disputes
- check unexpected blacklists/allowlist changes

Weekly:
- parameter drift review
- Merkle list freshness review
- runbook drill for intake/settlement pause scenarios
