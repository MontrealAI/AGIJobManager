# Validation — v1.12.0

Frozen application: `4e21737a0d79c6a611b96e3b7cc0e8ec0eb5a934`.
Tree: `8795bfc390cef887602cddcc7f507eaecc636ba3`.
SOURCE_CI.json identifies required runs and each job's actual checkout marker.
The publication workflow rechecks this evidence and verifies uploaded hashes.

## Public checks

- 765 contract/tool tests passed locally and across all four exact-source CI shards. New tests cover per-cohort loss/supervision masking and project cash scenarios, including failed dependencies, missing outcomes, unstarted cash, deposits, precision, capital and loss limits.
- All 16 existing simulation accounting regressions passed. This release does not claim to execute another 10,000 real jobs or replace simulation assumptions with observations.
- Security qualification includes dependency audits, compiler compatibility, 32 Forge unit/fuzz cases, five invariants and the reviewed Slither findings gate. These automated/internal checks are not independent external assurance.
- 34 historical native-USDC/ENS fork cases passed and the committed cutover report matched the executed output. No public-chain deployment or paid customer settlement was performed.
- Required UI unit, fuzz, browser, accessibility, header/security, deterministic-build and committed-artifact checks are recorded in SOURCE_CI.json.
- Documentation passed for 185 current guides, local files, headings, commands and release labels. The broader alignment audit covered 201 guides and 18 deployment/recovery commands. The root documentation commands now synchronize/check generated UI deployment metadata as well.
- 35 offline release-gate regressions and 35 frozen-console function checks passed locally.

Initial candidate CI rejected stale version-bound source fingerprints. The dependency locks were compared after removing only application-version fields: all dependency resolutions matched the previous release. Only affected package-file fingerprints were refreshed; finding rationales, source checks and byte-for-byte fork gates remained intact. Generated UI release metadata was also refreshed before final qualification. Historical release directories, legal records, deployments, Solidity and existing payout behavior remain unchanged.

## Private companion checks

Fleet 1.10.0, Agent 1.16.0 and Node 2.17.0 passed 172, 259 and 267 unit tests respectively: **698**, with no failures or skips. After the final refresh-order adjustment, all 34 native refresh/runtime cases passed again. All three isolated contract integration suites passed; Fleet exercised 11 cases and 18 signed local transactions, ending with zero manager reserves and token balance. Desktop/model/provider and publishing fixtures do not establish physical Mac operation.

All 21 vendored native-core copies match the public modules. Current private guides passed for 126 pages and 506 local links. Eighteen desktop/mobile browser checks covered each start page, economics guide and pilot guide. The Fleet, Agent and Node archives each reproduced byte for byte and passed CRC, manifest and executable-launcher checks. Their manifests verified 8,571, 2,898 and 2,933 files respectively. Checksums establish integrity, not developer signatures.

Private source and archives are delivered separately and are not public GitHub release assets. The exact public source identity is recorded in private release evidence; private native source hashes are derived from their actual workforce modules.

## Operational boundary

The economics planner accepts declared assumptions and grants no authority. Its probability scenarios cannot establish actual demand, independence or exhaustive failure coverage. The new source requires fresh matching production attestations; V2 now enforces maximum loss and supervision inside each held-out cohort as well as existing pooled gates.

Actual Macs, permissions, live models, signing-account isolation, long-running recovery, independent valuable-job outcomes, provider bills, real paid settlements and supervision remain uncommissioned here. No independent external security review was performed. Native execution has whole dedicated-account UI authority; scoped credential brokering, local-only model execution, automatic private-to-chain settlement and general automated moderation remain unimplemented. Failed project stages do not acquire new payment rights or automatic repair authority.
