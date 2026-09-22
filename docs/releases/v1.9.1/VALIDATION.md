# Validation — v1.9.1

Qualified source: `f32b600d3a09d75850a0e506810b51aa2bb79003`. Tree: `b5333cde3fcdd697ab4a2214a9e77d905f9966de`. `SOURCE_CI.json` records all five workflows and eight successful source jobs with verified actual checkout markers. Publication rechecks these identities, reproduces the archive and verifies uploaded asset digests.

## Public evidence

- 688 contract/tool cases across four exact-source CI shards: 166 + 180 + 159 + 183.
- 113 deployment preflight cases, including four new recovery-only execution regressions; 11 local deployment integration cases.
- 32 Forge unit/fuzz cases, five invariants, and the complete 12 / 29 / 122 reviewed static-analysis findings in the respective reports.
- 34 historical native-USDC/ENS fork cases: 11 native-USDC plus 23 cutover cases. The workflow reproduced the committed report byte-for-byte, including current package/tooling fingerprints and all observations. These are local forks, not live transactions.
- UI: 178 unit cases, six additional fuzz cases, nine end-to-end, four accessibility and two header cases; 19 standalone-console browser cases and the UI smoke case. Deterministic build, committed HTML, dependency audit and generated deployment checks passed.
- 180 current guides passed content, command and local file/heading-link checks; the broader release-alignment scan covered 196 guides and 18 deployment/recovery commands. Generated entry guides and complete npm inventories matched package metadata.
- Publication preparation runs 35 release-gate regressions and 35 frozen-console function checks. The latter use mocks, not wallet transactions.
- Manager runtime remains 24,359 bytes. All Solidity and dependency resolutions are unchanged. Only the version field changed the root lockfile fingerprint; the fork report also records changed package scripts. The required source workflows reran the affected qualification gates successfully.

The focused local anchor regression initially exposed a self-link checker defect. It was fixed before the qualified source was committed. The final source workflows above all passed.

## Private companion evidence

Fleet 1.7.1, Agent 1.13.1 and Node 2.14.1 passed 76, 165 and 174 unit tests respectively (415 total) on Node 24.19.0/Linux. Current offline checks cover 102 pages and 382 local links across the three standalone package boundaries, including source-digest freshness, working heading anchors, command inventories and executable Mac launchers. Private archives contain their current logs, provenance, validation and manifests.

This patch changes documentation, version labels, guide tooling and the vendored admission CLI help. Private live-admission/signing logic, runtime image pins, dependency resolutions and contract artifacts remain unchanged. Prior hardware screenshots and economic simulations remain historical; they are not relabeled as fresh live results. Exact current private integration results are included in the private validation guides.

Actual M1/M2 permissions and isolation, live models and billing, independent employers/reviewers, recovery and operator exception time still require commissioning. The shipped adapter handles isolated public computer work. Native signed-in/private-account execution is not implemented. These checks do not establish a flawless system, independent external audit, production profitability or universal autonomy.
