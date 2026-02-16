# Owner Runbook (Low-Touch Operations)

This runbook is for owner-controlled AGIJobManager operations with Etherscan-first workflows.

## 1) Deployment checklist

1. Compile with repo defaults (Truffle profile used for deployment): see [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md).
2. Deploy/link external libraries exactly as built (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).
3. Verify AGIJobManager + linked libraries on Etherscan.
4. Read-check post-deploy:
   - `owner`, `agiToken`, `voteQuorum`, thresholds, periods,
   - `settlementPaused == false`,
   - allowlist roots and ENS roots are correct.
5. Optional identity lock after confidence period: `lockIdentityConfiguration()`.

## 2) Safe defaults and staged rollout

Recommended staged rollout:
1. Start with stricter caps (`maxJobPayout`, `jobDurationLimit`) and higher moderation attention.
2. Keep `voteQuorum` consistent with expected validator activity.
3. Add small pilot allowlists (`additionalAgents` / `additionalValidators`).
4. Expand Merkle roots gradually after proof generation checks.
5. Lock identity configuration only after ENS/token wiring is final.

## 3) Incident playbooks

## A) Stop intake only
Goal: allow existing settlement while blocking new assignment/funding.
- Call `pause()` (or `pauseIntake()`).
- Keep `settlementPaused = false`.

## B) Stop settlement only
Goal: freeze settlement/dispute/finalize during investigation.
- Call `setSettlementPaused(true)`.
- Intake can optionally remain open (not usually recommended).

## C) Full stop
- Call `pauseAll()`.
- Resume in order: `unpauseAll()` only after incident checklist and communications.

## 4) Safe treasury withdrawal (escrow-solvency)

Before `withdrawAGI(amount)`:
1. Call `pause()` first (`withdrawAGI` requires paused).
2. Read `withdrawableAGI()`.
3. Ensure `amount <= withdrawableAGI`.
4. Execute `withdrawAGI(amount)`.
5. Confirm post-withdraw `withdrawableAGI()` and solvency state.

Never use withdrawals to bypass escrow obligations.

## 5) Allowlist governance (Merkle roots)

1. Build candidate list offline.
2. Generate root/proofs:
   ```bash
   node scripts/merkle/export_merkle_proofs.js --input addresses.json --output proofs.json
   ```
3. Validate random sample proofs offline.
4. Update roots on-chain.
5. Publish change notice (effective timestamp + migration guidance + proof file hash).

## 6) ENS operations

- Configure ENS integration addresses and roots before lock.
- Configure ENS job pages via `setEnsJobPages`.
- Enable/disable ENS-backed token metadata via `setUseEnsJobTokenURI`.
- `lockIdentityConfiguration()` freezes token/ENS/namewrapper/root-node setters permanently.

## 7) High-risk actions

Use explicit change ticket + peer review for:
- `rescueETH`
- `rescueERC20`
- `rescueToken`
- `lockIdentityConfiguration`
- all config setters that affect settlement risk

## 8) Operational command snippets

```bash
# bytecode budget guard
npm run size

# full CI-like test entrypoint
npm test

# ENS selector/calldata compatibility tests
node test/ensAbiCompatibility.test.js
node test/ensJobPagesHooks.test.js
```
