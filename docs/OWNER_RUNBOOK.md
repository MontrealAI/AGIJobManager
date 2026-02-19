# OWNER RUNBOOK (Low-touch operations)

This runbook is optimized for autonomous, checklist-driven operations and Etherscan-first control.

## 1) Deployment checklist

1. Compile with repository defaults (Truffle + optimizer settings from `truffle-config.js`).
2. Link external libraries exactly as deployment scripts/Truffle artifacts require.
3. Deploy constructor args carefully:
   - AGI token address,
   - base IPFS URL,
   - ENS config addresses,
   - root nodes,
   - initial Merkle roots.
4. Verify AGIJobManager and linked libraries on Etherscan (see [`VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md)).
5. Verify ENSJobPages and ensure selector compatibility tests pass:
   - `handleHook(uint8,uint256)` -> `0x1f76f7a2` / calldata `0x44`
   - `jobEnsURI(uint256)` -> `0x751809b4` / calldata `0x24`
6. Run post-deploy sanity reads: `paused`, `settlementPaused`, Merkle roots, root nodes, token address.

## 2) Safe defaults + staged rollout

- Phase 0: `pauseAll` enabled; configure params/roles.
- Phase 1: controlled intake (`unpause` and keep `setSettlementPaused(false)`), because `createJob`/`applyForJob` also require settlement lane active.
- Phase 2: enable settlement (`setSettlementPaused(false)`) once moderators/validators are ready.
- Use conservative thresholds/quorum first; ratchet only after observing production behavior.

## 3) Incident playbooks

## A) Stop intake only (allow settlements to finish)
1. `pause()` (or `pauseIntake()`).
2. Keep `setSettlementPaused(false)`.
3. Communicate: no new jobs, active jobs continue.

## B) Stop settlement only (allow intake to remain visible)
1. `setSettlementPaused(true)`.
2. Keep intake state unchanged.
3. Communicate expected resume timing.

## C) Full stop
1. `pauseAll()`.
2. Verify both lanes paused (`paused==true`, `settlementPaused==true`).
3. Publish incident bulletin + next decision checkpoint.

## 4) Revenue withdrawals without escrow risk

Before `withdrawAGI(amount)`:
1. Read `withdrawableAGI()`.
2. Ensure `amount <= withdrawableAGI()`.
3. Confirm protocol is paused for withdrawals (`withdrawAGI` requires `whenPaused` and settlement not paused).
4. Execute withdrawal in small chunks when uncertain.

Never bypass solvency checks via rescue functions for AGI escrow assets.

## 5) Allowlist governance (Merkle roots)

Rotation procedure:
1. Build root + proofs offline from canonical address list.
2. Peer-review generated root/proofs.
3. Announce effective block/time and grace period.
4. Call `updateMerkleRoots(validatorRoot, agentRoot)`.
5. Publish proof file and rollback plan.

Use deterministic scripts:
```bash
node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json
```

## 6) ENS operations

- Configure ENS via `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`.
- Point job pages with `setEnsJobPages`.
- Enable/disable ENS-backed token URI path via `setUseEnsJobTokenURI`.
- Lock identity config permanently with `lockIdentityConfiguration` only after full validation.

`lockIdentityConfiguration` is irreversible. Delay until final addresses/nodes are battle-tested.

## 7) High-risk actions (operator warnings)

- `rescueERC20`, `rescueToken`: emergency-only, must not violate escrow solvency assumptions.
- `updateAGITokenAddress`: identity-critical; only before lock.
- `updateEnsRegistry`/`updateNameWrapper`/`updateRootNodes`/`setEnsJobPages`: identity-critical; only before lock.
- Parameter setters affecting incentives (`setValidatorBondParams`, `setAgentBondParams`, `setValidatorSlashBps`, `setVoteQuorum`, etc.) should use change tickets and announced effective times.
