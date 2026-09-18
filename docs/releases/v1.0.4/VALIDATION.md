# v1.0.4 validation

Frozen application source: `042a998b72d528570e0252eca760f39b95491cf7`, tree `03396c4ce457f31131de577bd468f95024121eec`. Publication preparation changes only release evidence, tooling and the release workflow. The publisher requires every required job and its exact-source checkout marker to pass before publication.

## Local evidence

| Check | Executed result |
| --- | --- |
| Solidity build/export, lint and size guard | Passed; zero compiler warnings/errors; manager runtime 24,359 bytes |
| ABI and creation/deployed bytecode comparison with v1.0.3 | All three identical; everything after the opening source comment is byte-for-byte unchanged |
| Contract/console regression suite | 533 passed |
| Deployment/preflight/readiness/setup/verifier suite | 106 passed |
| UI lint, typecheck and unit tests | Passed; 178 tests across 20 files |
| Standalone console checks | 35 passed |
| Publication gate regression tests | 35 passed; source identity, required jobs, checkout evidence and draft asset handling remain enforced |
| Mainnet legacy/ENS cutover | 23 local-fork cases passed; source-bound committed report regenerated |
| Static-analysis review-gate tests | 11 passed; actual analyzer execution remains a separate CI gate |
| Root/UI documentation and distributed UI | Generated references, embedded-notice equality, links, deployment registry and static artifact verification passed |

Local real-browser execution was blocked by an unavailable Chromium download. It is not counted as a pass; the required source CI runs the browser suite, including three new stale-acknowledgement/review-cancellation regressions. Local runs use disposable accounts, mocks or local forks and broadcast no public-chain transactions. CI uses the pinned Node/compiler/tool versions.

## Exact-source CI

All entries below are required qualification runs. Their final successful conclusions and actual job-log checkout markers are verified live by the release publisher; a planned or merely started run cannot qualify the release.

| Workflow | Source run |
| --- | --- |
| CI, all four contract shards and console browser checks | [35387327583](https://github.com/MontrealAI/AGIJobManager/actions/runs/35387327583) |
| Security Verification | [35387327597](https://github.com/MontrealAI/AGIJobManager/actions/runs/35387327597) |
| UI CI | [35387327600](https://github.com/MontrealAI/AGIJobManager/actions/runs/35387327600) |
| Mainnet USDC Fork Qualification | [35387327581](https://github.com/MontrealAI/AGIJobManager/actions/runs/35387327581) |
| Docs Integrity | [35387327686](https://github.com/MontrealAI/AGIJobManager/actions/runs/35387327686) |

Security qualification includes actual deployment/size tests, dependency audits, compiler checks, Foundry unit/fuzz/invariants and the complete Slither finding set. UI qualification includes browser, accessibility, header/security and deterministic distribution checks. The fork workflow executes both the native-USDC and legacy/ENS suites, then compares the source-bound report. These remain technical checks, not an audit opinion or legal clearance.

## Scoped review and preservation

The MIT License is unchanged. Existing legal instruments are not amended by publication. Other Solidity files, libraries, dependency resolutions, historical deployment records and prior release evidence remain preserved. The static-analysis baseline updates the manager comment hash, root lockfile version hash and location-sensitive finding IDs. Comparing the actual v1.0.3 and v1.0.4 analyzer reports showed identical full descriptions after the exact 73-line manager-comment shift: 9/29/115 findings per report (reports overlap), with 2/3/16 location-sensitive IDs updated. Detector configuration, severities, confidence, review rationale and evidence references are preserved. The comparison and report digests are recorded in `source/docs/qualification/v104-slither-comment-review.json`; the updated baseline must reproduce in exact-source CI.

The internal scope review is `source/docs/qualification/V104_OPERATOR_NOTICES.md`. The notices disclose actual control and fees, use mandatory-law exceptions, avoid unsupported publisher/operator identities, and distinguish local acknowledgement from valid contractual agreement. This review is not jurisdiction-specific professional advice.

Packaging verifies source ancestry/tree, the exact change inventory, evidence digests and historical preservation. The publication workflow builds twice and compares assets byte-for-byte; it creates a draft, verifies uploaded sizes/digests and only then publishes the source-pinned release. It refuses to replace a published release or move an existing tag. Independent legal/security review, real signer control, operator adoption and live-instance readiness remain separate evidence.
