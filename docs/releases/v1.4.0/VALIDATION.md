# v1.4.0 validation

Frozen application source: `78fe5e4b0962f4776bb829413c2f3f1e7bc8d755`, tree `2004cbefa276c42cd2f36e48a7e5522db033c5cb`. Publication preparation changes only this edition's evidence and release tooling/workflow. Every required source job must pass at this exact checkout before publication.

## Executed local checks

| Check | Result |
| --- | --- |
| Complete contract/tool suite | 589 collected, executed and passed; includes 21 new admission cases and the existing settlement differential tests |
| New admission behavior | Lifecycle branches, 50-reviewer dilution, required zero-weight stress, exact expected values, Ed25519 tampering, operator thresholds, stale evidence, controller conflicts, aggregate capital/cost/job limits, priced gas, strict schemas, canonical dual-RPC disagreement/reorg/freshness/token/confirmation-depth checks |
| Pinned mainnet legacy/ENS cutover | 23 local-fork cases passed; observations match v1.3.0; source fingerprints updated from the newly executed report |
| Solidity lint and ABI/runtime size checks | Passed; no Solidity or build-input changes |
| Documentation | Root and UI checks passed, including exact embedded protocol-notice synchronization |
| UI distribution | Production build and single-file generation passed; 35 mocked standalone console checks passed |
| Dependencies | Root, Hardhat and UI lockfiles match v1.3.0 after removing only their own package-version fields |
| Preservation | Contract files, legal notices, license, deployment history and earlier release directories unchanged |
| Publication gates | 35 regression cases; edition paths updated with the existing gate logic preserved |

These are local software and fork tests. The admission suite does not measure customer demand, model quality, employer value, live gas prices, human workload, real reviewer independence or commercial profitability. No private application tests or private simulations are counted as public qualification.

## Required exact-source CI

| Workflow | Required run |
| --- | --- |
| CI — four contract shards and console/browser checks | [35667315925](https://github.com/MontrealAI/AGIJobManager/actions/runs/35667315925) |
| Security Verification | [35667315917](https://github.com/MontrealAI/AGIJobManager/actions/runs/35667315917) |
| UI CI | [35667316000](https://github.com/MontrealAI/AGIJobManager/actions/runs/35667316000) |
| Mainnet USDC Fork Qualification | [35667315892](https://github.com/MontrealAI/AGIJobManager/actions/runs/35667315892) |
| Docs Integrity | [35667315965](https://github.com/MontrealAI/AGIJobManager/actions/runs/35667315965) |

The publisher independently verifies every run, the complete eight-job set and an exact `QUALIFIED_SOURCE_COMMIT` marker in each actual job log. Incomplete, skipped, failed or differently checked-out jobs do not qualify. Security includes dependency audits, deployment checks, Foundry fuzz/invariants and full reviewed Slither findings. UI includes browser journeys, accessibility, headers, security and deterministic artifact checks. Fork qualification uses native Circle USDC and legacy/ENS preservation cases.

## Preservation and packaging

All Solidity files, ABI/bytecode inputs, library links, payouts, legal notices, license and historical release/deployment records are unchanged from the v1.3.0 publication commit. The Slither baseline change is limited to the root lockfile fingerprint after a package-version bump: dependency resolutions, findings, dispositions, analyzer settings and contract sources are preserved and must reproduce in CI.

`CHANGES.json` records the exact delta from the v1.3.0 application tag, including its subsequent publication evidence. `PREVIOUS_RELEASE.json` records the prior release and asset digests. `release.json` binds those files and `SOURCE_CI.json` by SHA-256. Packaging verifies source/tree identity, ancestry, inventory, evidence digests and protected paths, archives only the frozen public git tree and validates every payload hash. Two builds must be byte-identical.

Publication stages a draft, verifies each asset's size/digest, then publishes. Existing published tags/assets are not replaced. Private Agent, Node and fleet implementations, credentials and private artifacts are excluded. There is no deployment or public-chain transaction. Economic decisions remain conditional on supplied assumptions, and the public primitives do not grant transaction authority.
