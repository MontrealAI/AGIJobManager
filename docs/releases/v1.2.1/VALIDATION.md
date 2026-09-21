# v1.2.1 validation

Frozen application source: `a34f12482855c64104d3e1cd7871d35a013e4f49`, tree `de20960de19d3419da6edc5518e30d829f7b3902`. Publication preparation changes only this edition's evidence and publication tooling/workflow. Required source jobs must succeed at this exact checkout before publication.

## Executed local checks

| Check | Result |
| --- | --- |
| Review reproduction | 7 existing focused tests passed; 2 added tests intentionally failed against v1.2.0 for number-based reads and unverified token labelling |
| Full contract/tool suite after corrections | 555 passed, including 12 settlement-status cases |
| Actual CLI transport | Local HTTP tests cover matching/mismatched RPC observations, stale primary/secondary heads, future heads, unsupported hash reads, custom-token labels, historical reads, exit codes and redacted errors |
| Mainnet legacy/ENS cutover | 23 pinned local-fork cases passed; newly executed report matches committed evidence |
| Public RPC capability probe | Read-only canonical-hash code and six-decimal reads for native USDC at Ethereum block 26028547, hash `0xedc9331d96b6d22d17fbebad8c1c59b2af0d34147e84b722dc3333cb25d16fe4`; no manager deployment or transaction |
| Solidity lint and ABI/runtime size checks | Passed; Solidity sources and build inputs retained |
| Documentation | Root/UI checks and exact embedded protocol-notice synchronization passed |
| UI distribution | Production build and single-file generation passed; 35 standalone mocked console checks passed |
| Dependency preservation | Root, Hardhat and UI lockfiles match v1.2.0 after excluding their own package-version fields |
| Publication gate regression suite | 35 passed; edition paths updated without weakening gate logic |

The adversarial tests and cutover use isolated local deployments/forks. The public RPC probe confirms that endpoint's read capability at the recorded block, not production manager readiness or independent RPC honesty. Browser, security and other complete source checks are required through CI below. Private application tests and simulations are not counted as public release qualification.

## Required exact-source CI

| Workflow | Required run |
| --- | --- |
| CI — four contract shards and console/browser checks | [35657342889](https://github.com/MontrealAI/AGIJobManager/actions/runs/35657342889) |
| Security Verification | [35657342937](https://github.com/MontrealAI/AGIJobManager/actions/runs/35657342937) |
| UI CI | [35657342860](https://github.com/MontrealAI/AGIJobManager/actions/runs/35657342860) |
| Mainnet USDC Fork Qualification | [35657342891](https://github.com/MontrealAI/AGIJobManager/actions/runs/35657342891) |
| Docs Integrity | [35657342856](https://github.com/MontrealAI/AGIJobManager/actions/runs/35657342856) |

The publisher independently requires every run to succeed, the complete set of eight jobs and an exact `QUALIFIED_SOURCE_COMMIT` line in each actual job log. Started, skipped, incomplete or differently checked-out jobs do not qualify. Security checks include dependency audits, compiler/deployment checks, Foundry fuzz/invariants and complete reviewed Slither findings. UI checks include browser journeys, accessibility, headers, security, deterministic builds and committed artifact freshness. Fork checks execute native Circle USDC and legacy/ENS preservation tests.

## Preservation and packaging

All Solidity files, legal notices, MIT License, deployment history and previous release evidence are unchanged from the v1.2.0 publication commit. The Slither review changes only the lockfile fingerprint for the package-version bump; dependencies, findings, dispositions and analyzer settings remain identical and must reproduce in CI. Contract ABI/bytecode inputs, payout rules and library links are preserved.

`CHANGES.json` records the exact delta from the v1.2.0 application tag, including subsequent publication evidence. `PREVIOUS_RELEASE.json` records that release and its asset digests. `release.json` binds these files and `SOURCE_CI.json` by SHA-256. Packaging checks source/tree identity, ancestry, inventory, evidence digests and protected paths, archives only the frozen public git tree, and verifies every ZIP payload hash. The workflow builds twice and requires identical bytes.

Private Agent, Node, fleet implementations, credentials and private test artifacts are excluded. Publication uploads a draft, verifies asset sizes/digests, then publishes; existing published releases and tags are never replaced. These checks support the stated software scope. They do not establish an absolute quality ceiling, independent audit, live deployment approval, useful-work throughput or guaranteed recovery of every future obligation.
