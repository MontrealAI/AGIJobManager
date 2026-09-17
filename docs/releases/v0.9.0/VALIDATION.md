# v0.9.0 validation

Frozen application commit: `ed5369094c6ff277f74b077b3cb26f86afa16a67`.

Application tree: `c2555404b2691af4fa23700f5141f2aeea20a6b7`.

## Required source qualification

Publication requires all five workflows below and all eight constituent jobs to complete successfully. GitHub pull-request jobs check out synthetic merge commit `f64722e86a154253da42a715b470dec3e01b7135`; its tree is identical to the frozen application tree. The publisher rechecks that equality, repository identity, source SHA, workflow paths and every required job's success before creating the release.

| Gate | Source run | Scope |
| --- | --- | --- |
| Contract CI | [35247258974](https://github.com/MontrealAI/AGIJobManager/actions/runs/35247258974) | All four regression shards, lint, compile, bytecode guards, standalone checks and browser transaction smoke |
| UI CI | [35247259527](https://github.com/MontrealAI/AGIJobManager/actions/runs/35247259527) | Full UI audit, lint/types/build, unit/property/browser/accessibility/header checks and reproducible standalone builds |
| Documentation integrity | [35247259065](https://github.com/MontrealAI/AGIJobManager/actions/runs/35247259065) | Generated reference freshness, required guidance, links, ENS reference and repository policies |
| Security verification | [35247258940](https://github.com/MontrealAI/AGIJobManager/actions/runs/35247258940) | Root production and Hardhat audits, deployment/recovery tests, Foundry fuzz/invariants and retained static-analysis evidence |
| Actual-USDC fork | [35247259768](https://github.com/MontrealAI/AGIJobManager/actions/runs/35247259768) | Actual Circle USDC at a pinned historical Ethereum block, with all transactions confined to the local fork |

## Measured coverage

- **Deployment and recovery:** 59 preflight/readiness/recovery tests and four actual local deployment cases. The final regression covers both a failed confirmation after manager broadcast and a failed first runtime read. Recovery uses the original journal without editing it, verifies all six contracts, sends no additional blockchain transaction and preserves the need for owner proposal/acceptance. Running that regression against the original deployment script reproduced the missing-library-link failure.
- **UI:** 171 unit tests, a separate six-case bond/property suite, nine browser flow checks, four accessibility checks and two header checks. CI also checks static-build security, deterministic builds and the committed standalone artifact. The primary console has 35 additional mocked-function regression checks. These are not tests of every real wallet/provider combination.
- **Foundry:** 27 tests across unit, fuzz and invariant suites; 256 samples per fuzz test. Four stateful invariants each run 64 sequences at depth 64, totaling 16,384 calls. The directed lifecycle handler records zero unexpected reverts; terminal assertions require every tracked remaining job to settle, zero reserves and exact surplus. The unrestricted handler also exercises expected rejected calls; those are not described as zero-revert runs.
- **Actual native USDC:** eight fork scenarios at Ethereum block 25,997,388, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`. The suite verifies implementation `0x43506849D7C04F9138D1A2050bbF3A0c054402dd` and runtime hash `0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea`; ordered settlement, separate bonds, issuer pause/blocklist rollback and recovery are exercised.
- **Contract regression coverage:** 405 tests pass across four required shards (128 / 86 / 113 / 78), partitioning all 61 recursively discovered test files, including helpers and legacy comparisons. Runtime remains 24,537 bytes under the qualified Solidity 0.8.23 / optimizer 40 / Shanghai profile. Production Solidity and qualified compiler configuration match v0.8.0.
- **Evidence verifier:** nine permanent tests exercise a valid fixture and 27 rejection scenarios. Duplicate JSON keys, analyzer errors, malformed findings, missing/changed finding identities, source/configuration/lockfile drift and invalid review rationales are rejected.

## Review, static analysis and dependency limits

The final source received separate focused reviews of deployment/recovery, UI transaction safety and security-evidence/operational documentation. Those reviews found the manager-journal recovery defect, which was corrected and regression-tested. They did not establish additional release blockers within their scope. These are internal software reviews, not an independent security audit.

Slither 0.11.6's extended scan runs 59 medium/high detectors and retains 20 entries (five high, 15 medium). Its focused scan runs all six reentrancy detectors and retains 31 entries (one medium, 30 low). One finding overlaps, leaving **50 distinct reviewed findings**. The gate checks exact finding metadata and source-bound rationale. No detector-family suppression or zero-findings claim substitutes for this retained evidence. Raw reports are available in the security run's `static-analysis-evidence` artifact. See `source/docs/security/v0.9.0-static-analysis.md` and the referenced v0.8.0 triage.

The full UI audit and root production audit report zero known findings at qualification. Hardhat retains 14 low findings. The clean-install CI legacy root test tree reports 120 findings: 17 low, 55 moderate, 34 high and 14 critical. The recorded local snapshot differs because the installed/bundled dependency tree can differ. These are isolated Truffle/Ganache development dependencies; public-network Truffle signing is disabled. Do not provide production keys to that toolchain. Audit results depend on the advisory database and do not certify deployed contract security. See `source/docs/DEPENDENCY_SECURITY.md`.

## Release integrity

The packager verifies source commit/tree, the exact changes since v0.8.0, protected contract/compiler/historical paths and evidence hashes. It inventories every payload with SHA-256, checks archive contents and must produce identical bytes in two builds. The publisher verifies all four uploaded asset digests and refuses to move an existing tag or replace a published release. Offline regression tests exercise rejection of invalid CI qualification evidence before publication.

The tag identifies the frozen application source. The COMPLETE archive adds the release notes, evidence, manifest and current packaging scripts at its root. Release preparation is restricted to `docs/releases/v0.9.0/`, `scripts/release/` and the release workflow; it may not change the tagged application. Prior releases and deployment receipts are preserved.

## Live-operation boundary

No live contract deployment, activation, signer setup or recipient selection is performed. An existing verified v0.8.0 USDC instance is not forced to redeploy by these tooling changes; legacy-token migration still needs a fresh USDC instance. New managers begin paused and require source verification, owner handover and the read-only instance checker before activation.

The fork establishes behavior at its pinned historical state, not current issuer or network conditions. Owner/moderator authority, validator judgment, USDC issuer restrictions and external identity/metadata services remain explicit trust dependencies. High-stakes use requires independent source/operational review and a rehearsal with the actual intended configuration. Test success cannot establish flawless behavior across all possible attacks or operating environments.
