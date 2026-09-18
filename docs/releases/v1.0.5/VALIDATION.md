# v1.0.5 validation

Frozen application source: `83b199a38428500b60e14d6fb983ebb33b175ad7`, tree `3b820c824c0012ff7b9ed4cce6328f95b1959063`. Publication preparation changes only release evidence, tooling and the release workflow. Every required job must pass and report this exact checkout before publication.

## Local evidence

| Check | Executed result |
| --- | --- |
| Solidity build/export, lint and size guard | Passed; zero compiler warnings/errors; manager runtime 24,359 bytes |
| ABI and creation/deployed bytecode preservation | Identical to the v1.0.3/v1.0.4 baseline; all executable Solidity and the manager's line count are unchanged from v1.0.4 |
| Contract/console regressions | 543 passed, including upload approval/payload binding, credentials, completion isolation/drift and administrative text review |
| UI lint, typecheck and unit tests | Passed; 178 tests across 20 files |
| Standalone console checks | 35 passed |
| Publication gate regressions | 35 passed; exact source, complete required job set, checkout evidence and draft asset handling remain enforced |
| Mainnet legacy/ENS cutover | 23 local-fork cases passed; source-bound committed report regenerated |
| Static-analysis review-gate tests | 11 passed; actual analyzers remain a separate CI gate |
| Documentation and generated distribution | Root/UI checks, exact embedded-notice equality, generated references/deployments and single-file verification passed |

Local real-browser execution is not counted as a pass: Chromium was unavailable locally. Required source CI runs the real browser tests, including four new storage, credential, posting-review and upload regressions. Local tests use mocks or local forks and broadcast no public-chain transactions.

## Exact-source CI

These are required qualification runs. The publisher verifies their final successful conclusions, every required job and each actual checkout marker live; a started run cannot qualify the release.

| Workflow | Source run |
| --- | --- |
| CI, all four contract shards and console browser checks | [35391405534](https://github.com/MontrealAI/AGIJobManager/actions/runs/35391405534) |
| Security Verification | [35391405597](https://github.com/MontrealAI/AGIJobManager/actions/runs/35391405597) |
| UI CI | [35391405577](https://github.com/MontrealAI/AGIJobManager/actions/runs/35391405577) |
| Mainnet USDC Fork Qualification | [35391405541](https://github.com/MontrealAI/AGIJobManager/actions/runs/35391405541) |
| Docs Integrity | [35391405543](https://github.com/MontrealAI/AGIJobManager/actions/runs/35391405543) |

Security qualification includes deployment/size tests, dependency audits, compiler checks, Foundry unit/fuzz/invariants and the full Slither finding set. UI qualification includes real-browser, accessibility, headers, security and deterministic distribution checks. Fork qualification executes native-USDC and legacy/ENS suites and compares the committed source-bound report.

## Scope and preservation

The MIT License, dependency resolutions, executable Solidity, historical deployment records and earlier release evidence remain intact. The Slither review baseline changes only manager-comment and root-lockfile fingerprints. All finding IDs, analyzer settings, rationale and evidence references are unchanged and must reproduce in source CI. No findings are suppressed to qualify this release.

The internal review is `source/docs/qualification/V105_PRIVACY.md`. The legal center cites official GDPR, EDPB and Canadian sources, distinguishes factual roles from contractual labels, and describes prospective adoption and mandatory-law limits. These technical checks and drafting guidance are not professional legal clearance or an independent security audit.

Publication gate regression tests remain required. Packaging checks source ancestry/tree, exact change inventory, evidence digests and historical preservation. The workflow builds twice and compares assets byte-for-byte, creates a draft, verifies uploaded sizes/digests, then publishes. It refuses to replace a published release or move an existing tag. Operator adoption, signer control and a live deployment's readiness remain separate evidence.
