# v1.6.0 validation

Frozen public source: `f40da1d0c3f773a4b9a936d708a3d2260aa51618`. Its tree and complete run identities are recorded in `release.json` and `SOURCE_CI.json`. Publication changes only this edition's release evidence, packaging scripts and workflow.

| Check | Result and scope |
| --- | --- |
| Full local contract/tool suite | 620 passed, including the existing settlement differential tests |
| Existing admission | 32 cases retained, covering schema 2 action/vote/delivery binding and legacy rules |
| New pre-funding and state/closure | 18 cases: exact intent, participant losses, value evidence, capacity/portfolio limits, canonical quote/receipt observations and deleted job zero |
| Browser persistence regressions | Two local cases, plus actual console browser checks in source CI |
| Mocked standalone console | 35 checks passed |
| Solidity build | 60 files compiled successfully; no contract source or dependency-resolution change |
| Documentation and generated UI | Root/UI integrity and production generation passed |
| Publication | Existing 35 offline release-gate regressions, exact-source CI/log verification and two byte-identical archive builds required |

## Required CI

| Workflow | Exact-source run |
| --- | --- |
| CI, four jobs | [35674790038](https://github.com/MontrealAI/AGIJobManager/actions/runs/35674790038) |
| Security Verification | [35674790009](https://github.com/MontrealAI/AGIJobManager/actions/runs/35674790009) |
| UI CI | [35674790018](https://github.com/MontrealAI/AGIJobManager/actions/runs/35674790018) |
| Mainnet USDC Fork Qualification | [35674790004](https://github.com/MontrealAI/AGIJobManager/actions/runs/35674790004) |
| Docs Integrity | [35674790007](https://github.com/MontrealAI/AGIJobManager/actions/runs/35674790007) |

The publisher verifies success, the complete eight-job set and an actual `QUALIFIED_SOURCE_COMMIT` marker in every job log. Failed, skipped or differently checked-out jobs cannot qualify. Fork qualification runs 23 native Circle-USDC/legacy/ENS cases. Security includes dependency audits, deployment tooling, Foundry fuzz/invariants and reviewed extended Slither findings. Actual browser checks cover the console and UI.

The root lockfile's Slither fingerprint and four fork-report package fingerprints were refreshed only after verifying unchanged dependency resolutions. Finding dispositions, analyzer settings, fork outcomes and Solidity remain unchanged. Earlier release directories, legal notices, license and deployment history are protected against the previous publication commit.

`CHANGES.json` records the exact source delta from v1.5.0. `PREVIOUS_RELEASE.json` retains its published asset digests. SHA-256 binds this evidence; the archive includes a per-file manifest. Two package builds must be identical, and GitHub asset sizes/digests must match before the draft is published. Previous tags/assets are not replaced.

These are software, local-chain and pinned-fork tests. They do not measure Mac performance, real models, employer demand/value, human workload, independent reviewer behavior or business profitability. Private application tests and the previous million-offer simulation are not counted as public qualification. No production transaction, live deployment or independent security audit was performed.
