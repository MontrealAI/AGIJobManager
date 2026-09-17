# v0.9.0 validation

Application commit: `eddd10f62414ca7d4f604f2f256dc33215df2bef`. Application tree: `eaaa07442c2f975d73dffc4509dac9b99ca28c0f`.

## Required exact-source CI

Every run must be completed/success. Publication rechecks the repository, workflow path, source SHA and successful status immediately before creating the tag and release. IDs are evidence references; linked logs report actual outcomes.

| Gate | Evidence |
| --- | --- |
| mainnet-fork.yml | [Run 35235068532](https://github.com/MontrealAI/AGIJobManager/actions/runs/35235068532) |
| security-verification.yml | [Run 35235068478](https://github.com/MontrealAI/AGIJobManager/actions/runs/35235068478) |
| ui.yml | [Run 35235068479](https://github.com/MontrealAI/AGIJobManager/actions/runs/35235068479) |
| ci.yml | [Run 35235068525](https://github.com/MontrealAI/AGIJobManager/actions/runs/35235068525) |
| docs.yml | [Run 35235068452](https://github.com/MontrealAI/AGIJobManager/actions/runs/35235068452) |

Contract CI retains all 61 recursively discovered test files across four isolated shards, plus lint, compilation, bytecode checks, 35 frozen-console checks and a browser transaction smoke test. UI CI runs the full dependency audit, unit/fuzz tests, browser navigation/accessibility/header suites, lint/types/build, documentation and deterministic standalone artifacts. Security CI covers deployment, Foundry, configured/extended static analysis and strict evidence parsing. The native-USDC fork gate cannot silently skip an unavailable RPC.

## Local qualification

- UI: 171 unit tests pass, including 18 new review/preparation/simulation/receipt regressions. Lint, typecheck, build and 35 frozen-console checks pass.
- Generated standalone artifact: two builds match; committed-artifact freshness passes. SHA-256 `020f619c481f459b05725a6be920bef22e3c1adfb1ccd6cdd42e26c68b80e209`, 195,732 bytes. This generated broader interface is distinct from the primary release console asset.
- Deployment: 58 preflight/readiness/recovery cases and 4 actual Hardhat deployments pass. Cases cover strict flags, typed verification outcomes, disabled verification, confirmed receipts, partial journals, identity expectations, reorg detection, source-verification recovery and explicit owner handover.
- Foundry: 27 tests pass; 256 cases per fuzz test; four invariants at 64 runs × 64 depth = 16,384 calls. Existing randomized jobs are drained to terminal states and all reserve totals must clear; owner changes must preserve bond snapshots. The new targeted fuzz case covers zero/nonzero bond changes between validator votes and exact rounding.
- Static evidence parser: 9 committed cases exercise valid input plus 27 rejection scenarios, including duplicate keys, malformed report structure, nonstandard numbers, invalid finding metadata and missing rationale/evidence.
- Documentation: generated references, required content and relative links pass. Entry-point checks now also include root, Hardhat and UI READMEs. Public-network Truffle instructions and obsolete payment/pause/API claims have been corrected or replaced with current canonical routes.

## Native USDC and production source

Production Solidity is byte-for-byte unchanged from v0.8.0. Historical deployment receipts, snapshot migrations and vendored Solidity dependencies remain unchanged. Compiler: Solidity 0.8.23, optimizer 40, Shanghai, no IR, metadata bytecode hash disabled, revert strings stripped. Manager runtime: 24,537 bytes, below EIP-170.

The required fork suite exercises eight actual-USDC scenarios at Ethereum block 25,997,388, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`. USDC implementation: `0x43506849D7C04F9138D1A2050bbF3A0c054402dd`; runtime hash: `0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea`. It checks ordered 8/30/10/52 settlement, separate default bonds, issuer restrictions, atomic rollback/retry and repeated-settlement rejection. All writes are local.

## Static analysis and dependencies

Slither 0.11.6 runs 59 medium/high detectors and six focused reentrancy detectors. The broad pass returns 20 entries; the focused pass returns 31 entries; together these are the same 50 distinct reviewed findings as v0.8.0. Every ID is retained. Source/config/lockfile bindings, scanner success, findings metadata and review rationale are checked. Raw reports are preserved as CI artifacts. See `source/docs/security/v0.9.0-static-analysis.md`; this is not a zero-findings or independent-audit claim.

Full UI and UI/root production audits have zero known advisories at qualification. A clean npm 10 UI install with lifecycle scripts passed against the committed lockfile. Hardhat's full audit has 14 low findings and no moderate/high/critical findings. The local legacy root development audit snapshot has 100 findings (17 low, 51 moderate, 22 high, 10 critical); advisory counts may vary by platform/time. Public-network Truffle signing is disabled. Read `source/docs/DEPENDENCY_SECURITY.md`.

## Integrity and limitations

The packager verifies source/tree, exact change inventory, protected paths and evidence hashes. Archive payloads are individually hashed; two release builds must match. The publisher verifies uploaded asset digests and refuses to replace published releases or repoint tags.

The readiness checker reports the fields it verifies and explicitly excludes unverified operational policy, private metadata and fresh explorer-query claims. It cannot establish signer security, participant eligibility, independent judgment or continuous future correctness.

No live manager, real recipient configuration, production signer rehearsal or independent audit is supplied. Owner/moderator trust, validator quality, external ENS/metadata systems and USDC issuer powers remain. Follow `source/docs/MAINNET_READINESS.md` before an actual high-stakes activation.
