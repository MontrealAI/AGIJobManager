# Validation — v1.10.0

Qualified source: `faf7ef50a8ffcb7891b7078ea511504eeea5b3a1`. Tree: `ef1e1c53854a2d67fef27dbdc5bbd6bc5e946d09`. `SOURCE_CI.json` records five successful workflows and eight jobs whose actual checkout markers were verified. Publication repeats these checks, rebuilds the archive and verifies uploaded asset hashes.

## Public evidence

- 722 contract/tool cases across four exact-source shards: 227 + 153 + 184 + 158. This includes 24 workforce qualification and 10 V3 regressions; the 45-case focused run also includes the existing computer-work tests.
- 113 deployment preflight cases and 11 local deployment integration cases.
- 32 Forge unit/fuzz cases and five invariants. Required static-analysis review, compiler compatibility and dependency audits passed. These automated checks are not an independent security audit.
- 34 historical native-USDC/ENS fork cases: 11 native-USDC and 23 cutover cases. The committed cutover report was reproduced byte-for-byte. These are local fork transactions, not a public deployment.
- UI: 178 unit cases, six fuzz cases, nine end-to-end cases, four accessibility cases and two header cases; 19 standalone-console browser cases and one UI smoke case. Deterministic builds, committed HTML, dependency audit and generated metadata passed.
- 182 current guides passed content, command, local-file and heading-link checks. The broader alignment scan covered 198 guides and 18 deployment/recovery commands.
- Publication preparation checks 35 release-gate regressions and 35 frozen-console functions using mocks, then reproduces deterministic archives.
- Manager runtime remains 24,359 bytes. Solidity, payouts and dependency resolutions are unchanged. Version/script fingerprint changes are recorded in the reproduced fork/static-analysis evidence.

## Private companion evidence

Fleet 1.8.0, Agent 1.14.0 and Node 2.15.0 passed 123, 212 and 220 unit cases respectively (555 total) on Node 24.19.0/Linux. All three existing local-chain integrations passed; Fleet exercised 11 cases and 18 signed local transactions with zero ending manager reserves/balance. Providers, publication and USDC were mocked. No real customer account or public-chain transaction was used.

The new native suite has 47 cases in Fleet/Agent and 46 in Node. It covers authenticated protocol fixtures, actual file capture, encrypted envelopes/checkpoints, role-specific grants/receipts, exact delivery binding, fresh frames, provider drift, uncertain mutations, process-kill persistence, reservations, revocation, checkpoint resumption and a four-stage independently reviewed project. Forged receipts, changed artifacts, cycles and insufficient budgets are rejected. The final focused suite passed after CLI/package hardening. An initial portable benchmark-serialization defect was fixed before the passing runs.

All 54 vendored public-module copies match the qualified public source. Preserved private contract provenance/artifacts and dependency resolutions match the previous edition. Private archives include current test/integration logs, source hashes and a prepared security-review scope. The scope is not a completed review.

Private guide checks cover 111 pages and 473 local links, including generated-source freshness, command inventory and executable launchers. Native/project/Node/entry pages were checked at desktop and mobile widths; the visual-test selector was corrected before the successful run. Checksums establish integrity, not a developer signature.

## Limits requiring operation or additional implementation

Actual M1/M2 permissions, signing-account isolation, live model/provider identity, signed-in accounts, physical restart/resume, multi-hour work, independent real-job validation, paid settlements, provider bills and human intervention time were not measured here. The broad commissioning matrix remains NOT_EXECUTED. No independent qualified external security review was available.

The native adapter grants whole dedicated-account UI authority; it does not enforce a per-site/application/business-action credential broker. Broker-scoped and local-only jobs are rejected. Envelope expiration does not erase recipients' copied plaintext. Remote project transport and operator-owned revocation files require provisioning. Projects use one Agent/Node pair, do not automatically authorize repair/reassignment and do not post/sign private settlement transactions. Production requires independently signed current exact-specification evidence; test fixtures cannot substitute for it.
