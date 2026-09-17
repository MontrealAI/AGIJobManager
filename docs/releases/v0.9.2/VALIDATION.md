# v0.9.2 validation

Frozen application commit: `1318ba1aea9c00c9226696da40baa90662f1a620`.

Application tree: `4910bbabe222fb9266fe2dc62ece84a6514c72f9`.

## Exact-source qualification

Publication requires all five workflows and all eight constituent jobs below to complete successfully. Every constituent job explicitly checks out `1318ba1aea9c00c9226696da40baa90662f1a620`, asserts `git rev-parse HEAD`, and emits its source identity. The publisher downloads each job log and requires exactly one matching anchored marker plus a successful assertion step. It also rechecks the repository, source SHA, workflow paths, complete job sets and tree identity before creating the tag and release. Missing or expired log evidence fails closed. The publication rehearsal exposed GitHub CLI's rejection of ANSI formatting in raw job logs. The captured log request explicitly permits those bytes; logs are neither rendered nor executed, and the exact anchored source-marker checks remain mandatory.

| Gate | Source run | Required coverage |
| --- | --- | --- |
| Contract CI | [35264787754](https://github.com/MontrealAI/AGIJobManager/actions/runs/35264787754) | Four contract shards, strict lint, warning-free artifact export, bytecode guards, local USDC walkthrough and console/browser smoke |
| UI CI | [35264787865](https://github.com/MontrealAI/AGIJobManager/actions/runs/35264787865) | Complete dependency audit, lint/types, build, unit/property tests, browser/accessibility/headers and deterministic standalone artifacts |
| Documentation | [35264787765](https://github.com/MontrealAI/AGIJobManager/actions/runs/35264787765) | Generated references, ENS documentation, links and repository policies |
| Security | [35264787761](https://github.com/MontrealAI/AGIJobManager/actions/runs/35264787761) | Complete root/deployment audits, compiler compatibility, deployment/recovery, fuzz/invariants and all-detector Slither review |
| Actual native USDC | [35264787759](https://github.com/MontrealAI/AGIJobManager/actions/runs/35264787759) | Eight actual-USDC scenarios plus twelve cutover scenarios using real ENS and the existing legacy manager |

## Measured checks

- **Contract regression:** 419 cases across four shards (128 / 96 / 132 / 63), recursively discovering all 64 test/helper files. The migrated runner rejects empty, exclusive or skipped suites and compares collected, executed and passed counts. All 419 also passed together under Node 22.23.2 after correcting the Mocha 12 constructor import.
- **Compiler and lint:** Hardhat exports 84 artifacts from the qualified build with zero compiler errors/warnings. Foundry compiles 110 source files with `--deny warnings`. Solidity and UI lint enforce zero unhandled warnings. Five source-local Solhint exceptions document intentional empty blocks; Forge exceptions document bounded casts, intentional deadlines and historical test-fixture behavior. No global detector family is disabled.
- **Deployment and verification:** 78 preflight/readiness/recovery/explorer tests plus 10 local deployment cases. These include full constructor-data size, requested transaction gas, substituted code/libraries, partial-broadcast recovery, exact explorer-source identity and paused two-step owner handover.
- **Foundry:** 36 tests: 31 unit/fuzz tests and five invariant/lifecycle tests. Fuzz cases use 256 samples. Four stateful invariants each use 64 sequences of depth 64, totaling 16,384 calls. The directed lifecycle invariant reports zero unexpected reverts and requires complete terminal reserve reconciliation; the unrestricted handler deliberately exercises rejected actions.
- **UI:** 177 unit tests, an additional six-case property run, nine browser flows, four accessibility tests, two header tests, and deterministic/committed-artifact checks. The primary USDC console has 35 mocked-function checks. The contract CI also runs the legacy browser smoke against a real local EVM. This does not establish compatibility with every wallet/provider.
- **Actual USDC:** eight cases at Ethereum block 25,997,388, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`. The fixture verifies implementation `0x43506849D7C04F9138D1A2050bbF3A0c054402dd` and runtime hash `0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea`. All transactions occur on the local fork; issuer pause/blocklist, rollback/retry, ordered settlement and separate bonds are exercised.
- **Evidence gates:** 11 static-review parser/gate tests cover a valid fixture and 33 rejection scenarios; 27 publication/asset-upload tests exercise source/workflow/job/tree mismatch, incomplete qualification, exact checkout association missing/duplicated/incorrect/unavailable log evidence, direct release-ID uploads, bounded retries, ambiguous-response recovery and rejection of mismatched assets. Compiler-patch tests reject unreviewed bytes and check exact output and idempotence.

## Deployment sizes

Profile: Solidity 0.8.37, via IR, optimizer 40 runs, Shanghai, no metadata bytecode hash and stripped revert strings. Node 22.23.2, Hardhat 3.17.0, Foundry 1.7.1 and Slither 0.11.6 are pinned by the qualification workflow/configuration.

| Component | Runtime bytes | Full tested initcode bytes | Deployment gas used |
| --- | ---: | ---: | ---: |
| AGIJobManager | 24,409 | 27,567 | 5,982,097 |
| ENSJobPages | 15,344 | 16,837 | 3,738,048 |
| AGIJobPages | 4,212 | 5,682 | 1,187,297 |
| ENSOwnership | 1,947 | 1,977 | 474,200 |
| UriUtils | 1,899 | 1,929 | 463,860 |
| TransferUtils | 872 | 904 | 241,467 |
| BondMath | 681 | 711 | 200,509 |
| ReputationMath | 411 | 441 | 142,164 |

All eight production components deploy with EIP-170 enforcement enabled. The manager has only 167 bytes of runtime headroom. Its maximum allowed 512-byte gateway constructor case has 28,047 bytes of full initcode and uses 6,346,527 gas, with a requested limit of 7,615,833. The ENS row uses a 240-byte root name. The router row uses ordinary URI strings; the preflight separately rejects oversized constructor strings before estimation or broadcast. Tests reject initcode above 49,152 bytes and requested gas above 16,777,216 on the actual local provider.

These measurements depend on the exact compiler profile and constructor inputs. They are not live Ethereum receipts or a promise that arbitrary configuration is valid.

## Security findings and installation notices

Full root, Hardhat and UI audits, including development dependencies, must each report zero known advisories at every severity. The release removes the discontinued Truffle/Ganache/Web3 1 tree and Hardhat 2 dependency chain. It does not reinterpret a production-only audit as a clean complete tree. Advisory results are time-dependent.

The original v0.9.0 mandatory scans contained 50 distinct findings. Thirteen corresponding findings are removed; 37 remain reviewed. The expanded all-severity scan covers all 102 enabled detectors and retains **116 distinct findings: 0 high, 7 medium, 36 low, 71 informational and 2 optimization**. Overlapping reports contain 7 extended, 30 reentrancy and 116 complete-inventory entries. Exact finding metadata, production/configuration/lockfile hashes and individual rationales are checked; unexpected drift blocks the release. Raw reports are retained in the security run's `static-analysis-evidence` artifact.

See `source/docs/security/v0.9.1-static-analysis.md` for the individual dispositions, including intentional rounding, empty vote mappings on cancellation, selective tuple fields, bounded external interactions and metadata event ordering. The accepted findings are not presented as repaired defects or a clean analyzer output.

Sixteen deprecated UI lockfile entries representing twelve package/version pairs remain, including compatibility-constrained wallet SDKs and ESLint 9. Their notices remain visible. `source/docs/security/v0.9.1-ui-tooling.md` records peer constraints, configured injected-wallet behavior and migration criteria. The official browser AsyncStorage adapter and OpenZeppelin compiler-compatibility changes have pinned upstream provenance and file hashes. A clean vulnerability audit does not establish upstream support or the absence of unknown vulnerabilities.

## Cutover corrections and release integrity

The actual PublicResolver uses `approve(bytes32,address,bool)`. The v0.9.1 helper called an unsupported selector, and its mock hid that mismatch. v0.9.2 includes the correction and requires successful real-resolver delegation, authorized employer/agent writes, outsider rejection and terminal revocation.

Twelve cutover scenarios run at Ethereum block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`, beside the actual legacy manager `0xB3AAeb69b630f0299791679c063d68d6687481d1`. They cover exact settlement and bond returns, micro-unit rounding, three validators, posting-time reward policy, disputed payouts/refunds, blocked transfers and retry, reserve isolation, ownership and emergency controls. A dedicated `usdc-v092.alpha.jobs.agi.eth` root is owned directly by the new helper on the fork. It is a tested proposal, not a live registration.

The legacy inventory includes all 12 allocated IDs, original-token balances/allowances, reserves, owners, pause state, ENS wiring/records and six completion NFTs. That inventory remains equal across the new lifecycles. A separate scenario exercises the original-asset exit of legacy job 11 without affecting the new manager. This is an explicit state inventory, not a formal proof over arbitrary storage. No public transaction is broadcast.

The machine report at `source/docs/qualification/mainnet-cutover.json` binds 68 contract, runtime, test, configuration and dependency inputs. CI reruns the scenario and compares its report byte-for-byte. `source/docs/qualification/USDC_CUTOVER.md` records scope and the operational transition. The real-ENS lifecycle uses short metadata; maximum permitted URI lengths can exceed the bounded 500,000-gas hook budget. Successful settlement alone does not certify metadata mirroring.

The manager and its five linked library sources are unchanged from v0.9.1. The production Solidity delta is the helper/interface correction; the mock is also updated. The focused static-review delta records selector/line-identity changes without changed detector classifications. New operator instructions remove default blanket approval over legacy names, require reviewed owner values, and reject failed/skipped hooks as qualification evidence.

The packager binds the source commit/tree, exact delta since v0.9.1, historical records preserved against v0.9.1 publication commit `cce5504b43c6684ccdde49b0888883c3612998d3`, and evidence hashes. That publication commit contains v0.9.1 evidence added after its application tag; the gate verifies its ancestry and every protected record. It inventories payloads with SHA-256 and must produce identical archives twice. The publisher uploads by the known draft release ID with bounded subprocess timeouts and retries, avoiding tag/GraphQL rediscovery. After an ambiguous response it inspects the same draft and reuses only an exact uploaded digest/size match. The initial tag-based upload command timed out with an empty draft; this recovery leaves the source tag unchanged. The publisher checks all four uploaded asset digests and refuses to move an existing tag, overwrite mismatched assets or replace a published release. Publication preparation may change only this release's documents, packaging scripts and release workflow; the qualified application stays frozen.

The tag identifies the application commit. The COMPLETE archive adds release notes, evidence, manifest and packaging tools at its root. Earlier release files inside `source/` remain historical.

## Live-operation boundary

v0.9.2 includes corrected ENS helper source. The legacy original-asset manager must remain separate from the fresh USDC deployment; use the corrected helper and dedicated namespace. Existing deployments, jobs, approvals and funds are untouched. No live deployment, mainnet activation, signer setup, recipient selection or independent audit is performed. The real operating configuration, signing access for manager and ENS authorities, public-testnet rehearsal, verified deployment receipts and live instance checks remain outstanding.

Before substantial exposure, obtain independent review and rehearse the actual configuration. Source verification, owner handover and read-only instance qualification precede activation. The fork describes pinned historical state; current issuer/network conditions must be rechecked. Owner/moderator powers, validator judgment, USDC issuer restrictions and ENS/metadata dependencies remain explicit trust assumptions.
