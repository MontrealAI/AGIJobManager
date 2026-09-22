# Validation — v1.9.0

Source: `ddf59dd505d0761e2c8a9f7c9d82106436763f07`. Tree: `3554dc096b6a92d862a8a9dac740b68d440a0e3d`. `SOURCE_CI.json` records all five workflows and eight source jobs. Each workflow checks out this commit explicitly. Publication verifies actual checkout markers, complete job success and source/tree identity, then compares two deterministic archives and confirms every uploaded asset digest.

## Public checks

- 677 contract/tool cases across four source CI shards; four new cases exercise no-retainer admission and execution-window boundaries.
- Security workflow: 11 local deployment cases, 32 Forge unit/fuzz cases, five invariants and the complete reviewed static-analysis findings.
- 34 historical native-USDC/ENS fork cases: 11 USDC and 23 cutover checks. These are local forks, not live broadcasts.
- UI workflow: unit, fuzz, browser, accessibility, security, documentation, deterministic-build and committed-console checks. Exact totals are recorded in the source-job evidence.
- Documentation alignment: 194 active guides and 16 verified deployment command references.
- 35 offline publication-gate cases and 35 frozen-console function checks. Function checks use mocks; they are not wallet transactions.
- Manager runtime remains 24,359 bytes. Solidity, dependency resolutions and payout rules are unchanged. Version-only package fingerprints were refreshed in the reviewed static-analysis/cutover records; existing findings and observation values were preserved.

An initial UI qualification attempt detected stale generated deployment metadata. It was corrected before this source was frozen. Earlier failures do not qualify this release; the manifest records only successful runs for the final source.

## Private companions

Fleet 1.7.0, Agent 1.13.0 and Node 2.14.0 passed 73, 165 and 174 unit tests respectively (412 total) on Node 24.19.0/Linux. Fleet integration passed 11 cases and 18 signed local transactions with zero final manager reserves and balance. Agent and Node lifecycle integrations passed. Both workers reproduced all 11 bundled contract artifacts exactly. All 42 vendored public module copies match this source. Offline guide checking covered 90 pages and 354 local links with no broken links.

These rehearsals use local mock USDC and mocked provider/publication adapters. Historical browser screenshots and studies retain their original identities; no new physical-Mac or live-model benchmark is claimed. Review budgets are configured allowances, not provider billing meters. Older economic simulations remain historical evidence; this release does not rerun or relabel them.

Live commissioning must still establish actual M1/M2 permissions and isolation, provider quality and invoices, independent employer/reviewer control, economic outcomes, recovery and human exception time. Signed-in native applications and private accounts are not implemented by the bundled isolated-public-work adapter. Publishing software does not deploy a contract, open intake or qualify production profitability.
