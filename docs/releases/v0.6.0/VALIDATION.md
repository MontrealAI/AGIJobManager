# v0.6.0 validation

Application commit: `4b656a033929e5699d3c074fc4334502f8ca0ee8`. Application tree: `21a6eee1e021a2f1942661b91ebe1ae621b25b6e`.

## Required source CI

Every run below must report completed/success for this exact commit. The publisher rechecks the GitHub API immediately before creating the tag or release. The linked logs contain the actual results; `SOURCE_CI.json` records immutable run identifiers and this required gate.

| Gate | Evidence |
| --- | --- |
| ci.yml | [Run 35181617954](https://github.com/MontrealAI/AGIJobManager/actions/runs/35181617954) |
| ui.yml | [Run 35181617896](https://github.com/MontrealAI/AGIJobManager/actions/runs/35181617896) |
| security-verification.yml | [Run 35181617986](https://github.com/MontrealAI/AGIJobManager/actions/runs/35181617986) |
| docs.yml | [Run 35181617909](https://github.com/MontrealAI/AGIJobManager/actions/runs/35181617909) |

Contract CI includes lint, compiler build, EIP-170 bytecode size, full Truffle regressions, ABI checks and browser transaction smoke. UI CI includes lint/types/build, 117 unit/runtime/property tests, additional property checks, real-browser end-to-end/accessibility/header tests and reproducible standalone artifacts. The frozen primary console verifier exercises 35 checks. Security CI includes Foundry unit/fuzz/invariant runs and configured Slither analysis; detector/path exclusions remain documented in `slither.config.json`.

## Distribution-specific evidence

- Ordered 8/30/10/52 payment at defaults; exact original-cost percentage arithmetic.
- Posting-time validator-rate snapshots survive later configuration changes.
- Distinct nonzero immutable recipients and a 1–60% validator-budget bound.
- Exact micro-USDC allocation, rounding, unused validator-budget routing and zero retained job-cost balance.
- Atomic rollback on each blocked recipient, successful retry, and double-settlement rejection.
- Wallet-share exclusion from cancellation and employer-win refunds; existing escrow and bond invariants.
- UI rejection of old or invalid managers and posting-time payout previews.

## Release verification

The complete archive is pinned to the source commit/tree. A complete change inventory and protected historical paths are checked. Deterministic ordering, timestamps and per-file digests allow two independent builds to be compared byte-for-byte. The publisher checks all four uploaded asset digests, refuses tag repointing or mismatching assets, and only then publishes a stable latest release.

## Boundaries

No live contract is deployed or upgraded and no live funds move. Both real settlement-wallet addresses remain required inputs for deployment. Canonical token and issuer restrictions are exercised with local fixtures; they do not certify an arbitrary deployed contract. ETH gas, USDC issuer controls, owner privileges and ENS dependencies remain operational assumptions. Automated verification is not an independent security audit.
