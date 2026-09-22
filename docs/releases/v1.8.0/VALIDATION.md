# Validation — v1.8.0

The application is pinned to source `295f2267b17092fa6924ebc1a91d8ffd0e0ab032`, tree `1c7eedfcde58124d156c5299be7b5f38a12a8d3f`. `SOURCE_CI.json` records the five required workflows and eight jobs. Publication independently verifies each workflow, job, actual checkout marker and tree, then compares two deterministic builds before publishing verified assets.

## Completed local checks

- 673 public contract/tool cases, including 11 new general-work/admission/report cases.
- 109 deployment preflight/recovery cases and 11 actual local-deployment cases.
- Documentation integrity: 192 active guides and 18 checked deployment command references.
- 35 release-gate regression cases and 35 frozen-console function checks. These console checks use mocked functions, not wallet or live-chain activity.
- Existing Solidity files are byte-for-byte preserved from the previous release preparation. Public package dependency resolutions are unchanged; root release version labels changed.

The source workflows additionally run public shard tests, Forge unit/fuzz/invariant checks, dependency and compiler-patch checks, the full reviewed Slither finding set, UI tests and accessibility checks, and 34 historical native-USDC/ENS fork cases. A local fork is not a public-chain deployment or proof of current signer control.

The first qualification attempts caught stale generated guides and package-version fingerprints in cutover/static-analysis evidence. Generated pages and the relevant source hashes were refreshed; dependency resolutions, contract bytes, observation values and reviewed finding dispositions remained unchanged. All release qualification refers to the final pinned source, not those earlier failed attempts.

## Experiment

10,000 distinct offers, two disjoint 5,000-offer cohorts and 180 simulated days per cohort. Three calibration policies plus the held-out baseline and a disclosed unplanned evaluation diagnostic produced 25,000 scenario-offer executions and 1,997,604 independently replayed events. Independent conservation, summary, qualification, issuer, retainer-state and retainer-gas comparisons passed. A clean reproduction rebuilt all three executables and matched every event hash and complete economic result.

No alternative met all frozen improvement constraints. Selection remained baseline; no production policy was promoted. The workload preserves original synthetic flags, costs and values but changes pool/load mapping, so compare matched policies inside this experiment. It is not live computer-task execution, a new million-offer run, measured provider quality or physical Mac capacity. See the complete report and `PROTOCOL.json`, `SELECTION.json`, `DEVIATIONS.json`.

## Private companion checks

The separately delivered Fleet/Agent/Node record reports 74/162/173 passing unit tests; Fleet integration passed 11 cases and 18 signed local transactions with final manager reserves zero; Agent and Node integrations passed. Both Studio browser journeys passed with mocked compute responses and desktop/mobile layouts. All 40 vendored public module copies were checked byte-for-byte against the pinned source. Offline guide checks covered 87 pages and 344 links without broken local links.

No actual M1/macOS commissioning, live model/provider invoice reconciliation, employer-value measurement or complete private native-USDC retainer lifecycle was performed. Private review budgets are configured allowances, not external billing meters. Runtime/evidence hashes bind records but cannot prove their truth or representativeness. Independent production commissioning remains required.
