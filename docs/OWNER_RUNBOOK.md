# AGIJobManager Owner Runbook

Operational guide for low-touch ownership and safe Etherscan-first operations.

## 1) Deployment checklist

1. Compile with repo defaults (Truffle path):
   - solc `0.8.23`, optimizer on, runs `50`, `viaIR: true`, `evmVersion: london`, metadata bytecode hash `none`.
2. Deploy and link external libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).
3. Deploy AGIJobManager with final constructor args.
4. Verify on Etherscan with exact compiler + optimizer + viaIR + library mappings.
5. Confirm Read tab sanity:
   - token address,
   - pause flags,
   - review windows,
   - thresholds,
   - ENS/root configuration.

## 2) Safe defaults + staged rollout

Recommended rollout:
1. Start with lower `maxJobPayout` and conservative review windows.
2. Start with small validator quorum/thresholds that are reliably reachable.
3. Enable only initial allowlists first; announce onboarding criteria.
4. Run pilot jobs.
5. Scale payout caps and participant set after stable outcomes.

## 3) Incident playbooks

## A) Stop intake (keep settlement running)
1. `pause()`
2. Publish status update.
3. Diagnose and patch operations/docs.
4. `unpause()` only after checks pass.

## B) Stop settlement (and also gate key intake paths)
1. `setSettlementPaused(true)`
2. If broader risk: also `pause()`.
3. Investigate disputed/active jobs and communicate ETA.
4. Recover in reverse order: `setSettlementPaused(false)` then `unpause()`.

## C) Full stop
1. `pause()`
2. `setSettlementPaused(true)`
3. Freeze operator actions except emergency reads and communication.

## 4) Revenue withdrawal without harming escrow solvency

Always follow:
1. `pause()` (required by `withdrawAGI`).
2. Read `withdrawableAGI()`.
3. Withdraw only `amount <= withdrawableAGI()`.
4. Keep internal accounting record for each withdrawal.

Never use wallet-visible token balance as solvency source-of-truth.

## 5) Allowlist governance and root rotation

For Merkle root updates:
1. Build new root offline from approved addresses.
2. Publish effective date + proof distribution plan.
3. Ensure escrow is empty (root updates require empty escrow guard).
4. Call `updateMerkleRoots(validatorRoot, agentRoot)`.
5. Provide users the exact `bytes32[]` proofs for Etherscan paste.

## 6) ENS operations

- Set ENS helper: `setEnsJobPages(address)`.
- Optional ENS tokenURI path: `setUseEnsJobTokenURI(true/false)`.
- Configure nodes with `updateRootNodes(...)` (requires empty escrow).
- Lock permanently with `lockIdentityConfiguration()` only after final review.

Meaning of lock: identity wiring setters can no longer change.

## 7) High-risk actions (strict change control)

Require dual-review and written rationale before:
- `rescueToken`, `rescueERC20`, `rescueETH`
- `lockIdentityConfiguration`
- risk parameter setters (`set*Bond*`, thresholds, quorum, review windows, payout caps)
- token address or root updates

Recommended process:
- pre-change checklist,
- simulation on test deployment,
- signed operator approval,
- post-change verification checklist.

## 8) Offline helper tooling for autonomy

- Merkle export (root + proofs):
  - `node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json`
- Etherscan input generator:
  - `node scripts/etherscan/prepare_inputs.js --action createJob ...`
- Offline state advisor:
  - `node scripts/advisor/job_state_advisor.js --input state.json`
