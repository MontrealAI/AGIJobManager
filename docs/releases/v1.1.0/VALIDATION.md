# v1.1.0 validation

Frozen application source: `db876a8021da6afcf7aa974489d13374e6d188b5`, tree `2bc563ca1bf4b1f5bfb3a0a3e4dfefce1e26b463`. Publication preparation changes only this release's evidence, tooling and workflow. Every required source job must succeed and report this exact checkout before publication.

## Local checks

| Check | Executed result |
| --- | --- |
| Deployment/preflight/readiness/verifier regressions | 107 passed, including missing/empty read-only defaults and explicit broadcast cases |
| Actual local deployment qualification | 10 passed, including library/runtime verification, ownership handoff, paused intake and size limits |
| Solidity build/export, lint and size guard | Passed; 60 Solidity files, zero compiler warnings/errors; manager runtime 24,359 bytes |
| Contract preservation | Every Solidity source unchanged from v1.0.5; manager ABI and creation/deployed bytecode identical to the prior build |
| Dependency resolution | Root, Hardhat and UI lockfiles unchanged after excluding their own package version fields |
| Mainnet legacy/ENS cutover | 23 isolated fork cases passed; committed report regenerated and every recorded source fingerprint checked |
| Documentation and notice synchronization | Root/UI checks and exact embedded protocol-notice equality passed |
| UI distribution | Production build and single-file/runtime-bundle verification passed |
| Standalone console regression checks | 35 passed using mocks; no wallet or public-chain transactions |
| Publication gate regressions | 35 passed; exact source, complete job sets, checkout evidence and draft asset handling remain enforced |

A direct local fork connection stalled; the completed rehearsal produced the source-bound report. The required CI fork job executes both native-USDC and legacy/ENS suites and compares that report byte-for-byte. Local mocked console checks are not described as real-browser coverage; the required CI jobs run that coverage.

## Exact-source CI

| Workflow | Required source run |
| --- | --- |
| CI — all four shards and console/browser checks | [35406061191](https://github.com/MontrealAI/AGIJobManager/actions/runs/35406061191) |
| Security Verification | [35406061196](https://github.com/MontrealAI/AGIJobManager/actions/runs/35406061196) |
| UI CI | [35406061204](https://github.com/MontrealAI/AGIJobManager/actions/runs/35406061204) |
| Mainnet USDC Fork Qualification | [35406061278](https://github.com/MontrealAI/AGIJobManager/actions/runs/35406061278) |
| Docs Integrity | [35406061207](https://github.com/MontrealAI/AGIJobManager/actions/runs/35406061207) |

The publisher checks the live successful conclusion of each run, all eight required jobs and the actual `QUALIFIED_SOURCE_COMMIT` line in every job log. A started run, incomplete job set, skipped job or different checkout cannot qualify this release.

Security qualification includes dependency audits, compiler checks, deployment/size checks, Foundry unit/fuzz/invariants and the complete Slither finding set. UI qualification includes browser journeys, accessibility, headers, security, deterministic builds and committed-distribution freshness. Fork qualification reproduces real-USDC and legacy/ENS outcomes on a pinned local fork.

## Preservation and packaging

The MIT License, every Solidity source, legal notices, historical deployment records and all prior release evidence are protected by explicit unchanged-path checks. The only Slither baseline change is the root lockfile fingerprint for the package's version bump. Dependency resolution, findings, dispositions, analyzer configuration and evidence references remain unchanged and must reproduce in source CI; no finding is suppressed.

`CHANGES.json` records the exact git delta from the v1.0.5 application tag to this source, including intervening release-evidence commits. `PREVIOUS_RELEASE.json` records v1.0.5's published metadata and asset digests. `release.json` binds those records and `SOURCE_CI.json` by SHA-256.

Packaging verifies the source tree, ancestry, change inventory, evidence digests and preservation paths. The workflow builds twice and compares assets byte-for-byte. Publication creates a draft, checks uploaded sizes/digests, and publishes only after all assets match. It refuses to replace a published release or move an existing tag. Each ZIP payload file is listed in the manifest.

The v1.0.5 legal/privacy notice is the protocol notice text bundled with this edition; the software version does not amend existing agreements. Internal technical qualification is not an independent security audit or legal clearance. Actual signer control, operator adoption and readiness to open a live deployment remain separate evidence.
