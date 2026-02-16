# OWNER_RUNBOOK

## 1) Deployment checklist

1. Compile with repo settings (`npm run build`).
2. Deploy external libraries required by AGIJobManager:
   - UriUtils
   - TransferUtils
   - BondMath
   - ReputationMath
   - ENSOwnership
3. Link libraries exactly in deployment artifacts.
4. Deploy AGIJobManager with intended constructor config.
5. Verify on Etherscan with exact compiler/optimizer/viaIR settings and library addresses.
6. Confirm Read/Write tabs render all expected functions.

## 2) Recommended safe defaults and staged rollout

- Start with conservative payout limits and duration limits.
- Start with higher validator quorum/thresholds and small allowlists.
- Keep `useEnsJobTokenURI` disabled until ENSJobPages path is validated.
- Phase rollout: internal pilot -> controlled allowlist -> broader onboarding.

## 3) Incident playbooks

### A) Stop intake (keep settlement open)
1. `pause()` (or `pauseIntake()`).
2. Keep `setSettlementPaused(false)`.
3. Communicate “no new jobs/applications, settlement continues.”

### B) Stop settlement (freeze completion/dispute lane)
1. `setSettlementPaused(true)`.
2. Keep intake policy explicit (optionally still paused).
3. Investigate and publish operator notice.

### C) Full stop
1. `pauseAll()`.
2. Verify `paused() == true` and `settlementPaused() == true`.
3. Run reconciliation before any withdrawals/parameter changes.

## 4) Revenue withdrawal safety

Use only while paused and settlement not paused constraints are met by contract guards.

Checklist:
1. Read `withdrawableAGI()`.
2. Ensure requested amount <= `withdrawableAGI()`.
3. Confirm incident state and solvency rationale are documented.
4. Call `withdrawAGI(amount)`.

Never assume gross token balance is withdrawable; locked escrow/bonds are excluded by contract accounting.

## 5) Allowlist governance + Merkle rotation

Rotation process:
1. Build new allowlist JSON offline.
2. Generate root/proofs with `scripts/merkle/export_merkle_proofs.js`.
3. Announce effective time and migration window.
4. Apply `updateMerkleRoots(validatorRoot, agentRoot)`.
5. Re-publish per-address proofs for users.

## 6) ENS operations

- Configure ENS integrations: `setEnsJobPages`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`.
- Enable ENS-backed tokenURI only when tested: `setUseEnsJobTokenURI(true)`.
- `lockIdentityConfiguration()` permanently freezes identity config setters.

## 7) High-risk actions (special approval required)

- `rescueERC20`
- `rescueToken`
- `lockIdentityConfiguration`
- identity setters (`updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `updateMerkleRoots`, `setEnsJobPages`)
- economic setters while escrow is empty (quorum/threshold/bond/time params)

Require change ticket, rationale, and post-change verification notes.
