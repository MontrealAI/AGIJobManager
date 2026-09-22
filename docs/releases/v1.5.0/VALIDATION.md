# v1.5.0 validation

Frozen application source: `989b4772bdf8c07a9db91c383d30090491809417`, tree `1bb6316970ba9f855ec979f4a2481c4cedf3cfce`. Publication preparation changes only this edition's evidence and release tooling/workflow. Every required source job must pass at this exact checkout before publication.

## Executed local checks

| Check | Result |
| --- | --- |
| Complete contract/tool suite | 600 collected, executed and passed; includes 11 new regression cases and the existing settlement differential tests |
| New admission behavior | Exact Agent/Node commitments, opposite-vote/delivery substitution, fixed ballots even in zero-weight stresses, schema downgrade and missing fields, role confusion, bounded attempts, detached results, canonical completion disagreement and job-zero/uint256 boundaries; prior admission/settlement checks retained |
| Pinned mainnet legacy/ENS cutover | 23 local-fork cases passed; observations match v1.4.0; source fingerprints updated from the newly executed report |
| Solidity lint and ABI/runtime size checks | Passed; no Solidity or build-input changes |
| Documentation | Root and UI checks passed, including exact embedded protocol-notice synchronization |
| UI distribution | Production build and single-file generation passed; 35 mocked standalone console checks passed |
| Dependencies | Root, Hardhat and UI lockfiles match v1.4.0 after removing only their own package-version fields |
| Preservation | Contract files, legal notices, license, deployment history and earlier release directories unchanged |
| Publication gates | 35 regression cases; edition paths updated with the existing gate logic preserved |

These are local software and fork tests. The admission suite does not measure customer demand, model quality, employer value, live gas prices, human workload, real reviewer independence or commercial profitability. No private application tests or private simulations are counted as public qualification.

## Required exact-source CI

| Workflow | Required run |
| --- | --- |
| CI — four contract shards and console/browser checks | [35671183314](https://github.com/MontrealAI/AGIJobManager/actions/runs/35671183314) |
| Security Verification | [35671183318](https://github.com/MontrealAI/AGIJobManager/actions/runs/35671183318) |
| UI CI | [35671183323](https://github.com/MontrealAI/AGIJobManager/actions/runs/35671183323) |
| Mainnet USDC Fork Qualification | [35671183351](https://github.com/MontrealAI/AGIJobManager/actions/runs/35671183351) |
| Docs Integrity | [35671183322](https://github.com/MontrealAI/AGIJobManager/actions/runs/35671183322) |

The publisher independently verifies every run, the complete eight-job set and an exact `QUALIFIED_SOURCE_COMMIT` marker in each actual job log. Incomplete, skipped, failed or differently checked-out jobs do not qualify. Security includes dependency audits, deployment checks, Foundry fuzz/invariants and full reviewed Slither findings. UI includes browser journeys, accessibility, headers, security and deterministic artifact checks. Fork qualification uses native Circle USDC and legacy/ENS preservation cases.

## Preservation and packaging

All Solidity files, ABI/bytecode inputs, library links, payouts, legal notices, license and historical release/deployment records are unchanged from the v1.4.0 publication commit. The Slither baseline change is limited to the root lockfile fingerprint after a package-version bump: dependency resolutions, findings, dispositions, analyzer settings and contract sources are preserved and must reproduce in CI.

`CHANGES.json` records the exact delta from the v1.4.0 application tag, including its subsequent publication evidence. `PREVIOUS_RELEASE.json` records the prior release and asset digests. `release.json` binds those files and `SOURCE_CI.json` by SHA-256. Packaging verifies source/tree identity, ancestry, inventory, evidence digests and protected paths, archives only the frozen public git tree and validates every payload hash. Two builds must be byte-identical.

Publication stages a draft, verifies each asset's size/digest, then publishes. Existing published tags/assets are not replaced. Private Agent, Node and fleet implementations, credentials and private artifacts are excluded. There is no deployment or public-chain transaction. Economic decisions remain conditional on supplied assumptions, and the public primitives do not grant transaction authority.
