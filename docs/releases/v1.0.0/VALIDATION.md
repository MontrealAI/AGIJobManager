# v1.0.0 validation

Application commit: `790facbcb0a9e9c2fea52a038b7c80fc2ba12795`

Application tree: `db3e0349ca24e59062eef5561732cca6e99c6346`

The tag pins this application commit. The later publication commit contains only release evidence and tooling. Packaging verifies the source tree, ancestry, change inventory and preservation of historical releases and deployment records. Publication requires every job in all five recorded source workflows to succeed and checks the actual source marker in every job log. `SOURCE_CI.json` identifies the runs.

## Executed qualification

| Check | Scope and result |
| --- | --- |
| Contract/console/economics regressions | 515 passed locally; required across four exact-source CI shards |
| New participant-guidance regressions | 13 cases covering disconnected/wrong-network/terms/deployment gates, buyer eligibility, agent/reviewer separation, accessible guidance and recovery navigation |
| New economic scenario regressions | 13 cases including hand-calculated outcomes, rounding, absent correct reviewers, 50-reviewer vote splits, collateral return versus income, cost shortfalls and invalid/extreme inputs |
| UI unit suite | 178 passed locally; source CI also runs six property-test cases |
| Deployment/preflight/verifier/readiness | 94 cases required by source security CI |
| Actual deployment and bytecode limits | 10 cases required by source security CI; manager runtime 24,359 bytes, 217 bytes below EIP-170 |
| Foundry unit/fuzz/invariant suite | 37 cases under CI profiles, with warning-free compilation required |
| Native Circle USDC fork | 8 passed locally and required in source CI |
| ENS and legacy cutover | 23 passed locally; executed source fingerprints match the checked-in report |
| Standalone release console | 35 checks passed, including transaction context, exact bonds and embedded source terms |
| Documentation and interfaces | Generated documentation, relative links, ENS and ABI parity checks passed |
| Browser/accessibility/headers | Exact-source CI requires wallet/RPC smoke, nine UI journeys, four accessibility and two header checks |
| Distribution | CI requires safety checks, deterministic rebuild and committed single-file artifact parity |

The new 26 cases are included in the 515 total, not additional to it. Browser evidence comes from GitHub Actions; no successful local Chromium execution is claimed. All chain qualification uses disposable local networks or isolated forks; no test proves possession of a production signer or authority over a live namespace.

The full 23-case cutover report was regenerated from execution. Its prior legacy observations and outcomes are unchanged; the source/package fingerprints identify 1.0. Existing original-asset obligations and namespace inventory remain preserved.

## Contract compatibility and review

No production Solidity source changed from v0.9.7. The creation/runtime bytecode, ABI and link references of all 12 production artifacts were compared against the compatible v0.9.6/v0.9.7 baseline and match. The release adds no proxy upgrade, escrow migration, settlement formula or authority change.

The bounded internal contract review examined five-reserve accounting, failed outgoing transfers, claims, non-delivery expiry, bad-work disputes, acceptance, no-vote escalation, neutral timeout, pause clocks, conflicts and owner mutations. It identified no new reproducible defect in the examined paths. Its source fingerprints and limits are recorded in `source/docs/qualification/V1_CONTRACT_REVIEW.md`; that source review is not an independent audit.

The economic tool was cross-reviewed internally against `JobSettlement`. An extreme-input arithmetic guard and acceptance-eligibility wording were corrected during review. The tool accepts explicit snapshots and cost assumptions; it does not determine live state, eligibility, probabilities, quorum, deadlines, transferability or work quality. Cancellation and no-submission expiry are outside its four counterfactual outcomes.

## Static analysis

Slither 0.11.6 runs all 102 enabled detectors, with separate medium/high and reentrancy reports. The clean full scan retains **115 reviewed observations: 0 high, 9 medium, 36 low and 70 informational**. All identifiers, severities, confidence values, dispositions and evidence match the v0.9.7 baseline. Only the root lockfile version hash changed. The source-bound verifier and its 11 tests pass; no detector is disabled.

An accepted internal disposition is not proof that external assurance is unnecessary. The verifier rejects source drift, missing reports, new findings, severity changes or missing rationale.

## Production boundaries

The console fixes misleading first-use guidance but does not complete real-user studies. `source/docs/V1_ACCEPTANCE.md` is an unexecuted observation protocol; its cases begin as not run. The launch checklist likewise does not supply production signers, recipients, ENS authority, NFT choices, reviewer/moderator availability or monitoring.

Owner pauses can delay exits, visible votes and hidden common control can undermine review, and a neutral timeout may leave honest work unpaid. Economic margins depend on actual costs and service arrangements; the 30%/10% recipients have no contract-enforced obligation to provide arbitration. Issuer restrictions can leave reserved claims unpaid until resolved. A new edition number does not remove these operating limits.

No public Ethereum transaction was authorized or broadcast as part of this publication. Independent assurance and actual deployment/activation evidence remain separate requirements.
