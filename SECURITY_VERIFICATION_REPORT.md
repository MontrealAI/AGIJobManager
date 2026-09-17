# Security Verification Scope — v0.9.0 USDC

This document describes the configured checks and residual assumptions. Exact run results belong to the v0.9.0 release evidence; this is not an independent audit.

The extended gate additionally runs all medium/high detectors and a dedicated reentrancy pass without detector-category exclusions. Its reviewed findings and source-bound baseline are preserved in [static analysis triage](docs/security/v0.9.0-static-analysis.md). A clean configured gate does not mean the extended scan returned no findings.

See [mainnet readiness](docs/MAINNET_READINESS.md) for deployment checks and limitations.

## Scope
- `contracts/AGIJobManager.sol`
- Utility libraries used by AGIJobManager
- ENS integration contracts and assembly call compatibility assumptions

## Tooling Versions
- Foundry: 1.7.1 (pinned by CI)
- Solidity compiler: `0.8.23` (from `foundry.toml`)
- Slither: `0.11.6`
- Echidna: not included (Foundry handler invariants already cover the multi-step state machine with deterministic CI runtime)

## Reproduction Commands
```bash
npm ci

# Foundry checks
forge fmt --check forge-test/**/*.sol contracts/test/MaliciousCompletionReceiver.sol
FOUNDRY_PROFILE=ci forge build
FOUNDRY_PROFILE=ci forge test --no-match-path "forge-test/invariant/*.t.sol"
FOUNDRY_PROFILE=ci forge test --match-path "forge-test/invariant/*.t.sol"

# Static analysis
pip install slither-analyzer==0.11.6
npm run slither
npm run slither:extended
python3 scripts/security/test-slither-review.py
```

## Added Verification Coverage

### Unit / Regression (Foundry)
- ENS authorization path regression:
  - deterministic NameWrapper ownership path succeeds for valid labels
  - invalid ENS label formatting is rejected deterministically.
- ENS selector and calldata compatibility checks assert:
  - `handleHook(uint8,uint256)` selector = `0x1f76f7a2`, calldata length `0x44`
  - `jobEnsURI(uint256)` selector = `0x751809b4`, calldata length `0x24`
  - low-level calls return ABI-valid string data.
- Strict transfer semantics:
  - Fee-on-transfer token is rejected in exact transfer flows.
- Integration resilience:
  - Reverting ENS hook target does not brick settlement.
  - Malformed ENS URI ABI does not break finalization.
- Reentrancy regression:
  - ERC721 receiver callback reentry into `finalizeJob` cannot double-settle.

### Fuzzing (Foundry)
- Boundary fuzz for:
  - payout and duration validity envelope in `createJob`
  - job spec/details/completion URI caps
  - dispute-bond floor/ceiling behavior (`[1 USDC, 200 USDC]`)
  - validator approvals/disapprovals accounting consistency at threshold/tie edges
  - hard validator cap enforcement (`MAX_VALIDATORS_PER_JOB = 50`)

### Invariants (Handler-based)
Handler actions include:
- create/apply/request completion/vote/finalize/dispute/resolve stale/expire/cancel/delist
- owner pause toggles and settlement pause toggles
- owner `withdrawUSDC` and `rescueERC20` under guarded preconditions

Invariants enforced:
1. **Solvency:** contract USDC balance is always >= all locked totals.
2. **Withdraw safety:** `withdrawableUSDC()` remains callable without reverting during valid operation.
3. **Locked accounting consistency:** aggregate locked totals exactly equal recomputed sums over live jobs.
4. **Vote accounting sanity:** `validators.length == approvals + disapprovals` per job.
5. **Terminal sanity:** mutually exclusive invalid flag combinations are disallowed.
6. **Agent concurrency cap:** `activeJobsByAgent <= maxActiveJobsPerAgent` for tracked actors.
7. **Deleted-job accounting sanity:** deleted jobs must carry zero residual bond/validator accounting fields.

## CI Integration
- Added `.github/workflows/security-verification.yml` for PR/push:
  - `forge fmt --check`
  - `forge build`
  - forge unit/fuzz tests
  - forge invariant suite
  - Slither execution with fail-on medium/high

## Slither Findings Triage
- **Accepted by design:** privileged owner/admin control surfaces (`onlyOwner`) per business-operated trust model.
- **False positives / low-noise filtered:** currently controlled via repository `slither.config.json` path filters and detector exclusions for non-actionable categories.
- **Earlier USDC migration scope:** settlement currency, economic/reputation scaling, immutable token configuration, and fail-closed UI guards changed. New USDC tests cover public-chain canonical addresses, six-decimal amounts and transfer restrictions.

## Residual Risks / Assumptions
- Owner/operator privilege remains central by design.
- Liveness and emergency controls (pause/settlement pause) are operational controls, not decentralized guarantees.
- ENS integration remains optional/best-effort and intentionally non-blocking for escrow lifecycle safety.

- USDC issuer pauses or blocked addresses can prevent transfers. Failed operations must preserve escrow accounting and be retried only after the underlying restriction is resolved.

## v0.8.0 qualification additions

The constructor starts intake paused; unsafe duration limits and self-targeted rescue calls are rejected. New fuzzing covers exact USDC transfer order, snapshotted budgets, micro-unit rounding, issuer restrictions and maximum-duration boundaries. The directed lifecycle handler asserts successful transitions without swallowing unexpected reverts, while checking concurrent-job reserves, owner extraction guards and ownership transitions. CI uses 256 fuzz cases per fuzz test and 64×64 calls per stateful invariant. A separate local mainnet-fork gate exercises the actual Circle proxy at a pinned finalized block without sending live transactions. Deployment tests check compiler/runtime matching, EIP limits, preflight failures, partial receipts and incomplete verification.

## v0.9.0 qualification additions

Production contract source is unchanged from v0.8.0. UI regression coverage now rejects changes during asynchronous preparation, overlapping review dialogs, edited reviewed identities and stale/failed simulation requests; reviews support keyboard focus and cancellation. Deployment rejects malformed control flags and ambiguous verification outcomes, records recoverable failures and checks readiness against consistent chain state.

Foundry adds bond-snapshot changes across the first and later votes, including zero-bond encoding. Stateful sequences must settle every remaining job and finish with zero reserves and the exact donation surplus; owner changes must preserve outstanding bond snapshots.

Slither 0.11.6 broadens the general pass to 59 medium/high detectors and the focused pass to 6 reentrancy detectors. The same 50 distinct findings remain individually reviewed; no finding IDs were regenerated. Evidence JSON parsing rejects duplicate keys and malformed structures, with 9 committed test cases covering 27 rejection scenarios. The full UI dependency audit now includes development tooling and has zero findings at qualification. Root legacy development advisories remain disclosed in the dependency report.
