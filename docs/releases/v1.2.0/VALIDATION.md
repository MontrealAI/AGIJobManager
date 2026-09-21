# v1.2.0 validation

Frozen application source: `12abd6c8a8066a66600991cdc865270978f5b855`, tree `54e69b5113bdafed3b19ba46daa62bf5bfcf427f`. Publication preparation changes only this edition's evidence, release tooling and workflow. Each required source job must succeed and report this exact checkout before publication.

## Local checks

| Check | Executed result |
| --- | --- |
| Contract/tool regression suite | 550 passed; seven settlement-status cases include actual local JSON-RPC CLI execution, exit codes, historical reads and redacted transport failures |
| Settlement-specific observations | Completed jobs with unpaid claims, selection coverage, permissionless recovery, pause-adjusted deadlines, donations, synthetic deficits, wrong chains, missing/cancelled jobs, simulated reorg, RPC disagreement and bounded inputs |
| Deployment/preflight/readiness/verifier regressions | 107 passed |
| Actual local deployment qualification | 10 passed |
| Solidity build/export, lint and size checks | Passed; contract sources and compiler settings preserved |
| Mainnet legacy/ENS cutover | 23 isolated pinned-fork cases passed; committed report matches the newly executed report byte-for-byte |
| Documentation and protocol notice synchronization | Root checks passed; embedded protocol notice unchanged |
| UI distribution | Production build and single-file generation passed |
| Standalone console regression checks | 35 passed using mocks; local browser download was unavailable, so actual browser qualification is required in CI |
| Publication gate regressions | 35 passed; complete source job sets, exact checkout logs and draft asset verification remain enforced |
| Dependencies | All three lockfiles match v1.1.0 after excluding their own package-version fields |

The tests use isolated local deployments or pinned local forks. They send no public-chain transaction and do not qualify million-job on-chain throughput, production uptime or autonomous moderation accuracy. Private application tests and simulations are not counted as public release qualification.

## Exact-source CI

| Workflow | Required source run |
| --- | --- |
| CI — all four shards and console/browser checks | [35653903097](https://github.com/MontrealAI/AGIJobManager/actions/runs/35653903097) |
| Security Verification | [35653903021](https://github.com/MontrealAI/AGIJobManager/actions/runs/35653903021) |
| UI CI | [35653903059](https://github.com/MontrealAI/AGIJobManager/actions/runs/35653903059) |
| Mainnet USDC Fork Qualification | [35653903069](https://github.com/MontrealAI/AGIJobManager/actions/runs/35653903069) |
| Docs Integrity | [35653903034](https://github.com/MontrealAI/AGIJobManager/actions/runs/35653903034) |

The publisher verifies each run's live successful conclusion, all eight required jobs and the actual `QUALIFIED_SOURCE_COMMIT` line in each job log. A queued, skipped, incomplete or differently checked-out job cannot qualify publication.

Security qualification includes dependency audits, compiler diagnostics, deployment checks, Foundry unit/fuzz/invariants and complete reviewed Slither findings. UI qualification includes browser journeys, accessibility, headers, security, deterministic builds and committed-distribution freshness. Fork qualification covers native Circle USDC and legacy/ENS preservation and compares the committed cutover report with newly executed observations.

## Preservation, privacy and packaging

All Solidity files, the MIT License, legal notices, historical deployment records and prior release evidence are protected by explicit unchanged-path checks against the previous publication commit. ABI, bytecode and fixed library links retain the same sources, compiler settings and resolved dependencies. The Slither baseline changes only the root lockfile fingerprint for package metadata; findings, dispositions and analyzer settings are unchanged and must reproduce in CI.

Only reviewed public repository changes are added to the release. No files from private AGI Agent, AGI Node, fleet packages, credentials or private qualification directories are included. Packaging archives the frozen public git tree, never the surrounding workspace.

`CHANGES.json` records the exact delta from the v1.1.0 application tag, including its subsequent publication evidence. `PREVIOUS_RELEASE.json` records v1.1.0 metadata and asset digests. `release.json` binds those files and `SOURCE_CI.json` by SHA-256. The packager checks source/tree identity, ancestry, inventory, evidence digests and protected paths, then checks every ZIP payload against the manifest. The workflow builds twice and requires byte-for-byte equality.

Publication creates a draft, verifies uploaded asset sizes/digests and publishes only when all match. It refuses to replace a published release or move an existing tag. Contract behavior, previous releases and live deployments do not change on publication. Internal qualification is not an independent audit, proof of guaranteed recovery, legal clearance or approval to open a funded deployment.
