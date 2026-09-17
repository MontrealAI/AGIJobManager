# v0.8.0 validation

Application commit: `a4ef8ac621e5a8ed6241243428bb9b43b17dd5d5`. Application tree: `5fc79aa5b009c200887b2e278657481e23733caf`.

## Required exact-source CI

Every run below must be completed/success. The publication workflow rechecks repository, workflow path, exact source SHA and successful status immediately before creating the tag and release. The recorded IDs are evidence references; the linked logs report actual results.

| Gate | Evidence |
| --- | --- |
| mainnet-fork.yml | [Run 35228876589](https://github.com/MontrealAI/AGIJobManager/actions/runs/35228876589) |
| ci.yml | [Run 35228876673](https://github.com/MontrealAI/AGIJobManager/actions/runs/35228876673) |
| security-verification.yml | [Run 35228876575](https://github.com/MontrealAI/AGIJobManager/actions/runs/35228876575) |
| ui.yml | [Run 35228876658](https://github.com/MontrealAI/AGIJobManager/actions/runs/35228876658) |
| docs.yml | [Run 35228876638](https://github.com/MontrealAI/AGIJobManager/actions/runs/35228876638) |

Contract CI runs lint, compilation, runtime-size checks, all contract regressions, 35 frozen-console checks and a browser transaction smoke test. UI CI runs lint/types/build, all unit tests, browser end-to-end/accessibility/header checks, production dependency audit, documentation and reproducible standalone builds. Security CI runs deployment tests/audit, Foundry fuzz/invariants, configured Slither and extended reviewed scans with raw JSON artifacts. The separate fork gate exercises actual native Circle USDC.

## Local qualification

- Atomic paused launch, unauthorized activation and two-step ownership behavior pass.
- Unsafe duration values and self-directed rescue calls are rejected; maximum-duration completion/expiry boundaries are covered.
- Eight bonded/admission regression cases pass, including all four reserve counters, blocked winners/refunds, issuer pause, manager blacklist, isolation between concurrent jobs, retries and repeated-settlement rejection.
- Foundry: 26 tests pass; 256 cases per fuzz test; four stateful invariants at 64 runs × 64 depth = 16,384 calls. The directed lifecycle handler executes 4,096 valid actions with zero unexpected reverts and deterministic coverage of successful, cancelled, expired, disputed/refunded and stale-completion routes.
- Actual-USDC fork: 8 cases pass at Ethereum block 25,997,388, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`. Implementation `0x43506849D7C04F9138D1A2050bbF3A0c054402dd`, runtime hash `0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea`. Exact 8/30/10/52 ordered cost settlement, separate default bonds, issuer restrictions and recovery pass. No live transactions are sent.
- Deployment: 20 preflight tests and 4 real Hardhat deployment cases pass, including chain/token/config rejection, exact linked runtime, partial journals, verification failures, owner acceptance, EIP-170 and EIP-3860 behavior.
- UI: 153 unit tests pass, including 26 transaction-context/posting-economics scenarios; 35 standalone-console checks, lint/types, production build, generated docs and committed-artifact freshness pass. Browser suites remain mandatory CI gates.
- Runtime: 24,537 bytes, under EIP-170; Solidity 0.8.23, optimizer 40, Shanghai, no IR or metadata hash.

## Static analysis and dependencies

Extended scans report 20 medium/high entries and 31 reentrancy entries (50 distinct findings). Each is retained with rationale and code/test evidence; the gate rejects new/removed/changed findings and source/config/lockfile drift. Twelve malformed-report/source-drift negative cases were rejected. Read `source/docs/security/v0.8.0-static-analysis.md`; no independent audit or zero-findings claim is made.

UI/root production audits have zero known advisories at qualification. The full Hardhat audit has 14 low findings and no moderate/high/critical findings. Legacy local test dependencies retain high/critical advisories; public-network Truffle signing remains disabled. See `source/docs/DEPENDENCY_SECURITY.md`.

## Integrity and deployment boundary

The packager verifies source commit/tree, the exact change inventory, protected historical paths and evidence hashes. All archive payloads are hashed, and two builds must match byte-for-byte. The publisher verifies all four uploaded asset digests and refuses to repoint tags or replace published releases.

No live manager, real wallet configuration, mainnet signer rehearsal or independent audit is supplied by this release. Follow `source/docs/MAINNET_READINESS.md` and the read-only instance checker before activation. Owner/moderator trust, validator judgment and Circle's issuer powers remain. Test success cannot certify every possible adversarial scenario.
