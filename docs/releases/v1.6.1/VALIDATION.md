# v1.6.1 validation

Frozen public source: `9207667cdb6da72a87577f8e85f06fdedaa0c95b`. Tree: `6ea5ecb9c07fb3fd08ec16314001219b0ea18c3d`. Publication changes only this edition's release evidence, packaging scripts and workflow.

| Check | Result and scope |
| --- | --- |
| Exact-source CI | Five workflows, all eight required jobs passed; emitted checkout markers independently verified |
| Contract/tool shards | 620 passed (183 + 122 + 170 + 145) |
| Hardhat preflight/recovery | 107 passed |
| Actual local deployments | 10 passed |
| Native-USDC fork qualification | 23 passed; pinned historical fork, no public-chain broadcasts |
| Source browser/UI | Actual console/browser, UI, accessibility, headers, security and deterministic output checks passed |
| Security | Root/Hardhat/UI dependency audits, compiler diagnostics, Foundry fuzz/invariants and reviewed Slither gate passed |
| Guide alignment | 190 active guides and 16 commands; eight deliberately introduced drift conditions rejected locally |
| Publication | 35 release-gate regressions, 35 mocked console checks and two identical archive builds required |

## Required source workflows

| Workflow | Exact-source run |
| --- | --- |
| ci.yml | [35677329166](https://github.com/MontrealAI/AGIJobManager/actions/runs/35677329166) |
| ui.yml | [35677329106](https://github.com/MontrealAI/AGIJobManager/actions/runs/35677329106) |
| docs.yml | [35677329182](https://github.com/MontrealAI/AGIJobManager/actions/runs/35677329182) |
| mainnet-fork.yml | [35677329099](https://github.com/MontrealAI/AGIJobManager/actions/runs/35677329099) |
| security-verification.yml | [35677329233](https://github.com/MontrealAI/AGIJobManager/actions/runs/35677329233) |

`SOURCE_CI.json` records every run and verified checkout. The publisher re-reads all required jobs and emitted markers; a failed, skipped, missing or differently checked-out job cannot qualify. The guide fault-probe record is in `GUIDE_CHECKS.json`.

Contract, deployment and admission sources are byte-identical to the previous publication. Dependency resolutions were compared before refreshing the lockfile's Slither fingerprint and four package fingerprints in the retained cutover report. Analyzer settings, finding dispositions, fork outcomes and legal/history records were not changed. `release.json` protects these paths against previous publication commit `260e540983745d146e010500f1818a0458cbad7d`.

`CHANGES.json` records the exact delta from the v1.6.0 source tag; it includes that edition's subsequently added publication evidence. `PREVIOUS_RELEASE.json` retains its published asset identities and digests. SHA-256 binds the evidence and every archive payload file. Previous tags and assets remain intact.

This evidence establishes tested software behavior. It does not measure real Macs, live providers, employer demand/value, human workload, independent participant behavior or sustained profitable throughput. Private unit results and older simulation outputs are not counted as public qualification. No production deployment, public-chain transaction or independent audit was performed for this patch.
