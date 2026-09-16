# v0.4.0 validation record

## Frozen application

| Field | Value |
| --- | --- |
| Repository | `MontrealAI/AGIJobManager` |
| Tag | `v0.4.0` |
| Source commit | `5d3607e98672487ec67f856079c154d340c3e848` |
| Source tree | `2fe8911c0a1e857db5a2caebae9cf8fcd9b2a44f` |
| Previous release | `v0.3.0-mainnet-ensjobpages-upgrade` |
| Primary UI | `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v33.html` |

The previous-release comparison contains 46 changed paths. The packager verifies the inventory in `CHANGES.json` and requires no changes to the protected paths listed in `release.json`, including contracts, protocol tests, deployment records/scripts and Next.js source/lockfiles. The release does not change application code or package versions.

## Historical checks of the exact source

| Workflow | Run | Coverage |
| --- | --- | --- |
| CI | [27019923649](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923649) | Dependency install, Solidity lint/build/size gates, Truffle and Node tests, repository UI smoke |
| Docs Integrity | [27019923862](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923862) | Binary-addition policy, generated documentation and ENS documentation checks |
| Security Verification | [27019923829](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923829) | Configured Forge format/build, unit/fuzz/invariant tests and Slither |

These successful runs are dated June 5, 2026. `SOURCE_CI.json` captures their metadata. The publisher queries GitHub again and checks repository, source SHA, workflow path and successful conclusion. Historical logs or artifacts may have expired; recorded GitHub job/run status is not a new execution.

## Fresh release gates

The release-preparation pull request must pass fresh CI, Docs Integrity, Security Verification and Current-State Release validation before merge. GitHub checks on that pull request are the authoritative fresh-run evidence. Publication runs only on the matching release descriptor's push to `main`.

The focused v33 verifier executes actual functions extracted from the pinned HTML with mocked dependencies. It covers all inline-script parsing, mainnet address consistency with the checked-in core receipt, agent/validator bond arithmetic and clamps, snapshot comparison failures, and the no-account recovery path that invalidates cached jobs and privileged UI state. It does not execute full browser transaction flows.

Packaging validation checks every archived file against the manifest and creates two byte-identical outputs in the same CI environment. ZIP timestamps, ordering and permissions are fixed. Compression-library differences between environments can affect ZIP bytes; payload digests remain the primary file-integrity record.

The publisher verifies local asset checksums, creates an annotated tag at the exact source commit, creates a draft, uploads the four assets and checks GitHub's SHA-256 digests before publishing as the latest stable release. It refuses to move an existing tag, replace mismatching assets, or modify an already published release. A rerun can resume a matching draft.

## Boundaries to carry into the next phase

- The root UI smoke test is not complete qualification of the Genesis Console. Focused mocked v33 checks add coverage but do not replace browser/wallet integration tests.
- No live mainnet transaction, ownership/parameter audit, bridge/vault qualification, dependency remediation or independent security audit is performed by this release. Existing tests and scanner exclusions are retained.
- The original ENS receipt records the superseded `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94` deployment. The replacement `0x06188E77C1C38d392b16d9D9fb24673363ce1da0` is supported here by the prior published release and v33 fallback, not by a newly fabricated receipt or fresh chain attestation.
- README and UI documentation preserve differing hosted console paths. The attached console is the pinned release artifact; hosted routing can be reconciled in the next development phase.
- The AEP-002 page workflow expects inputs absent from this source tree. It is retained as optional tooling and is not invoked or presented as completed standards evidence.

All of these limits are documented while preserving the requested current-state source snapshot.
