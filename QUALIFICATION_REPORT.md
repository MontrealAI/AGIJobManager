# Mainnet operator workflow qualification

Preparation baseline: `5f296a14727f3497128f3a49bd628c1f09a96221`.
Final-source identity belongs in the generated external qualification record and
candidate manifest; a document cannot self-embed its own final commit hash.

| Gate | Preparation result | Evidence / command |
| --- | --- | --- |
| Historical commissioning regressions | 167 PASS, no skips, Node 22.23.2 | Four existing historical test files |
| Full deployment preflight, including new commands | 482 PASS, no skips | `npm --prefix hardhat run test:preflight` |
| Contract suite | 779 PASS | `npm run test:shard -- 0 1` |
| Native compiler/NFT registry/runtime compatibility | 4 PASS | `npm --prefix hardhat run test:registry-native` |
| Native deployment tests | 11 PASS | `npm --prefix hardhat run test:deployment` |
| Native Circle USDC historical fork | 11 PASS at declared historical snapshot | `npm --prefix hardhat run test:mainnet-fork` |
| Historical USDC/ENS cutover | 23 PASS | `npm --prefix hardhat run test:cutover` |
| UI unit suite | 209 Vitest PASS; security test suite also executed | `npm --prefix ui test` |
| Docs/generators and local links | PASS after regeneration | `npm run docs:gen`, `npm run docs:check` |
| ABI/contract/build boundaries | PASS | UI ABI check, boundary script; Solidity/compiler unchanged |
| Release gate tests | 47 PASS; dependency boundary regression PASS | `scripts/release/test-release-gates.py`, `test-dependency-boundaries.py` |
| Pinned browser binary download | Local environment blocked download | Required browser CI remains a separate gate; older installed Chromium also cannot start because this environment denies its local socket |
| Original operator compiler-cache replay | NOT_RUN: originals not supplied | Do not substitute current builds for original cache evidence |
| Genuine paid participants / approval / operating basis | NEEDS_OPERATOR_INPUT | A1–A5 collection and `OPERATOR_ACTIONS_REQUIRED.md` |

These counts identify preparation runs, not a promise that subsequent edits were
qualified. Final-source CI must run all applicable jobs and required steps before
merge/publication. The manifest binds downloadable assets to exact source; package
integrity alone does not establish readiness. Static-analysis findings retain their
existing reviewed dispositions; they are not described as absent.

## Acceptance mapping

| Requirement | Implementation | Behavioral evidence | Scope |
| --- | --- | --- | --- |
| Historical preservation | Existing validator + `mainnet:evidence` | Historical mutation/strict JSON/CLI cases retained | Offline |
| Coherent inspection | Canonical reader + current orchestrator | Reorg, stale block, common hash and missing-build tests | Read-only, one provider |
| Complete NFT/reserve treatment | Existing compiler-derived registry + five-reserve accounting | Native registry and pending-claim/surplus cases | No empty-registry inference from errors |
| Bounded approvals | Range inventory + active-state reconciliation | Gaps/reorg/malformed/duplicate/truncation cases | Silent provider omission remains a limitation |
| A1–A5 collection | Versioned private input and referenced evidence | Missing/hash/stale/conflict/authority tests | Completeness, not authorization authenticity |
| Runtime/isolation/transport | Supported launcher + strict shared transport | Real subprocess, HHE22, split/hoisted peers, URL and failure tests | Fork only; no upstream writes |
| Recovery | Exact original-journal reconciliation | Historical identities retained; read-only route | No deploy/sign/nonce allocation |
| UI and docs | Historical display, explicit current unavailability, common operator guide | Generators, docs and UI checks | No automatic transaction-target selection |

A read-only preparation inspection at block 26,169,445 verified the existing ENS connection (66 allowed RPC requests, zero writes). Read-only journal recovery at block 26,169,450 reconciled all four historical helper stages; saved-artifact creation comparison remains NOT_RUN. These preparation observations are not final-source or activation evidence.

Merge: not performed. Release: candidate only, not published. Pages: source updated,
production deployment not performed. Intake: not authorized or activated.
