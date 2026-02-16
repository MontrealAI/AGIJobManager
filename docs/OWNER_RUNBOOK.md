# AGIJobManager Owner Runbook (Etherscan-first Operations)

This runbook is for business operators running AGIJobManager with Etherscan as the operational control plane.

## 1) Deployment checklist

## Toolchain reality (from repo)

- Truffle pipeline (`npm run build`, `npm test`) compiles with:
  - `solc` `0.8.23`
  - optimizer enabled, runs `50`
  - `viaIR: true`
  - metadata bytecode hash `none`
  - EVM `london` (unless overridden by env)
- Foundry config also exists and uses `solc 0.8.19` for forge-side tests/harness.

For Etherscan verification of Truffle deployments, use **the exact Truffle compiler settings**.

## Pre-deploy checklist

- Confirm AGI token address and decimals assumptions.
- Confirm ENS + NameWrapper addresses if using ENS authorization paths.
- Confirm initial root nodes and Merkle roots.
- Confirm owner and moderator operational keys.
- Confirm validator and agent policy docs are ready before go-live.

## External library linking

AGIJobManager uses external libraries (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).

You must:
1. Deploy libraries first (or use migration flow that does).
2. Link library addresses into AGIJobManager bytecode.
3. Verify with correct library name → address mapping.

## Etherscan verification checklist

- Correct network and deployed address.
- Correct compiler version (`0.8.23` for Truffle path).
- Optimizer enabled with runs `50`.
- `viaIR` must match deployment artifact.
- Library mapping exactly matches deployed linked addresses.
- Constructor arguments ABI-encoded exactly as deployed.

---

## 2) Safe initial configuration (“good defaults”)

These are operationally conservative principles, not legal/financial advice.

- `maxJobPayout`: start low enough that one failed workflow cannot threaten business solvency.
- Validator thresholds/quorum:
  - keep quorum reachable by your active validator set,
  - avoid thresholds that require near-perfect turnout.
- Bond parameters:
  - validator and agent bonds should be meaningful but not so high that participation collapses.
  - set `validatorSlashBps` conservatively; aggressive slashing can reduce validator willingness.
- Review windows:
  - set `completionReviewPeriod` long enough for human review coverage across time zones.
  - set `challengePeriodAfterApproval` to prevent immediate finalize races.

Operational rule: update risk-sensitive params only while escrow is empty when required by contract guards.

---

## 3) Incident response

## “Stop intake” vs “stop settlement”

- Stop intake: `pause()`
  - prevents new create/apply intake paths; validator voting is controlled by settlement pause.
- Stop settlement: `setSettlementPaused(true)`
  - freezes finalize/dispute/settlement progression.

## Recommended emergency sequence

1. `pause()` immediately.
2. If issue affects settlement logic, call `setSettlementPaused(true)`.
3. Announce public status and expected ETA.
4. Diagnose using Read Contract state + event logs.
5. Resume in reverse order when safe:
   - `setSettlementPaused(false)`
   - `unpause()`

---

## 4) Revenue withdrawal without escrow risk

Safe sequence:
1. `pause()`.
2. Read `withdrawableAGI()`.
3. Withdraw only `<= withdrawableAGI` via `withdrawAGI(amount)`.
4. Keep internal ledger entries for accounting/audit.

Never assume wallet-visible AGI balance equals withdrawable treasury.

---

## 5) Authorization governance (allowlists + Merkle roots)

## Direct allowlists (fast path)

- `addAdditionalAgent/removeAdditionalAgent`
- `addAdditionalValidator/removeAdditionalValidator`

Use for urgent exceptions and onboarding/offboarding.

## Merkle roots (scalable path)

- Build tree with leaf = `keccak256(abi.encodePacked(address))`.
- Publish root changes with effective time and communication notice.
- Update on-chain via `updateMerkleRoots(validatorRoot, agentRoot)`.

## Offline deterministic proof generation

- Script: `scripts/merkle/export_merkle_proofs.js`
- Example:
  - `node scripts/merkle/export_merkle_proofs.js --input allowlist.json --output proofs.json`

Distribute per-user proof arrays from `proofs.json` for Etherscan copy/paste.

---

## 6) Moderator and blacklist operations

- Moderators:
  - `addModerator(address)`
  - `removeModerator(address)`
- Blacklists:
  - `blacklistAgent(address, bool)`
  - `blacklistValidator(address, bool)`

Change-management best practice:
- keep signed change logs,
- announce user-impacting changes before enforcement when possible.

---

## 7) ENS operations

## Configure ENS job pages

- `setEnsJobPages(address)` to set helper contract.
- `setUseEnsJobTokenURI(bool)` to use ENS-based tokenURI path.

## Identity lock

- `lockIdentityConfiguration()` permanently freezes identity wiring controls.
- Perform only after:
  - ENS addresses confirmed,
  - root nodes/roots finalized,
  - rollback policy accepted as “none”.

---

## 8) Rescue functions (break-glass only)

- `rescueERC20`
- `rescueToken`
- `rescueETH`

Use only for accidental transfers/recovery incidents with documented approval from governance/ops leadership.
