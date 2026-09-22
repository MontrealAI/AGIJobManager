# v1.7.0 validation

Frozen source: `9b758293a7fdcf731299bf28264d601b4fa4e51f`. Tree: `4fde441da2b68abf2a5f19ac391ce6b221d15718`. Publication adds release evidence and packaging configuration; the application is packaged from this qualified source.

| Check | Result and scope |
| --- | --- |
| Source qualification | 5 workflows; 8 jobs; all successful with actual checkout markers verified |
| Contract/tool shards | 662 passed: 168 + 159 + 175 + 160 |
| Hardhat deployment | 109 preflight/recovery and 11 local deployment cases |
| Native-USDC fork | 11 lifecycle/retainer + 23 cutover cases; no public-chain broadcasts |
| Browser/UI | Console browser, unit/fuzz, accessibility, security/headers and deterministic committed-output gates passed |
| Security | Dependency audits, compiler checks, Foundry fuzz/invariants, internally reviewed Slither gate |
| Guides | 191 active public guides and 18 real deployment commands |
| Publication | 35 release-gate regressions, 35 standalone-console checks and two identical builds required |

## Exact-source workflow evidence

| Workflow | Run |
| --- | --- |
| docs.yml | [35689727938](https://github.com/MontrealAI/AGIJobManager/actions/runs/35689727938) |
| ui.yml | [35689727951](https://github.com/MontrealAI/AGIJobManager/actions/runs/35689727951) |
| mainnet-fork.yml | [35689727926](https://github.com/MontrealAI/AGIJobManager/actions/runs/35689727926) |
| security-verification.yml | [35689727923](https://github.com/MontrealAI/AGIJobManager/actions/runs/35689727923) |
| ci.yml | [35689727948](https://github.com/MontrealAI/AGIJobManager/actions/runs/35689727948) |

`SOURCE_CI.json` records every required job and checkout. The publisher re-reads the live run/job results and emitted marker; a failed, skipped, missing or different checkout cannot qualify. `CHANGES.json` records the delta from v1.6.1; `PREVIOUS_RELEASE.json` retains published asset identities.

The new companion received lifecycle, authorization, conservation, malicious callback, native-USDC pause/blacklist and deployment-immutable tests. The retained analyzer reports expose findings; the baseline contains written internal dispositions instead of disabling detectors. Existing manager contracts, legal/deployment records and historical releases are protected by `release.json`. The former cutover fingerprint record is archived under `docs/qualification/history/`; the current source fingerprint is updated.

## Capacity evidence and limits

`QUALIFICATION_BENCHMARK.json` records 200 paced and 200 burst synthetic requests on Linux/x64. It tests complete signed-envelope and report verification locally. It excludes live issuer issuance, RPC, evidence delivery, Macs, distributed reservations and real costs. Burst rejection is backpressure, not completed work. Concurrency slots do not make synchronous CPU work parallel.

No new million-offer run, mainnet deployment, independent audit or sustained production measurement is included. Fee payment is not quality assurance; activation exposes employers to reviewer nonperformance. Economic calibration is empirical and depends on honest, representative evidence. Production qualification requires independent review and funded commissioning with measured useful outcomes, participant losses, provider costs, employer value, reviewer/issuer latency, human work and recovery.
