# Candidate qualification boundaries

Version: 0.2.0-candidate.2. This follow-on source begins at companion PR #1588 commit `6eeac125ae69d68c6a67291604541fd887f76a85` and applies the owner's disjoint interface and narrow packaging handoffs before additional reviewed implementation. New source needs new acceptance; earlier constructors, native revisions and browser runs remain historical evidence.

| Evidence | Required scope | Deployment implication |
|---|---|---|
| Mac trust/build | Independently reviewed source/compiler/tool identities; local Standard JSON compilation; exact native artifacts, full plan and unsigned bytes | Ubuntu hashes or verdicts cannot authorize signing |
| Deterministic/server | Envelope, two-origin HTTP/CSP, persistence, cancellation/recovery, acknowledgement, one-shot attempt control, verification/authority validation | Implementation evidence only |
| Manager native acceptance | Exact selected source; actual nine-creation coordinator subprocess path plus recovery negatives | No physical Ledger or live-provider inference |
| Alpha native acceptance | Exact selected source; actual five-creation/two-binding subprocess path plus recovery negatives | No physical Ledger or global-pause inference |
| Jobs | Exact future external-manual adapter and actual acceptance required | Current refusal preserved |
| Real browser | Current pinned source/build, sandbox enabled; synthetic device explicitly identified | Physical USB acceptance remains separate |
| Explorer/runtime | Canonical receipt, exact source/compiler/settings/constructor/links/runtime, legitimate immutables; bounded durable service state | Submission/polling success alone is insufficient |
| Authority | Ownership, pending ownership, roles, upgrade/configuration and relevant dependency permissions | Missing live observations remain blockers |
| Physical USB Ledger/macOS | Owner-run path/address/display, exact approvals, cancellation/disconnect/restart and recovery | Pending until actual signed evidence exists |
| Mainnet provider/finality | Owner-reviewed chain/provider and independent canonical exact-hash reconciliation | Disposable fixtures cannot qualify it |

The delivered decision report supplies exact commits, dependency pins, commands, result counts, retained failures and evidence links. The compatibility inventory records accepted revisions only after actual native acceptance. Manager `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` and Alpha `38064bec3423218f87c6b81760ac6768b3e7d4e5` are new source targets; neither is certified by the earlier `eb6f…` / `d69c…` runs.

## Exact-source blocker recorded during review

Manager candidate `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` reverses the `agentRootNode` and `alphaClubRootNode` getter expectations relative to contract initialization in the native core-creation verifier. Distinct nonzero ENS roots therefore reject the correct deployed state. The production launcher blocks all campaigns on this exact source. An all-zero-root generic-engine fixture qualifies transport/recovery only and cannot qualify that policy or a live production launch. The implementation owner must correct the native verifier, freeze a new exact revision and rerun native plus companion acceptance with distinct nonzero roots. Do not change eligibility policy or choose equal/zero roots to bypass this defect. The separate deployment decision report records whether a later corrected source was actually supplied and qualified.

## Packaging checks

The owner's handoff preserves the original release `ROOT_DIRS`, forbidden paths and mode checks, adding an explicit companion file inventory instead of opening the whole `tools/` tree. Baseline reproduction passed 16 focused tests and the complete 98-test release-gate suite before further inventory changes. New runtime/tests/docs require explicit named additions and a refreshed exact source manifest. Generated `dist`, dependencies, private state/capabilities, logs, secrets, archives and unknown companion paths remain excluded from repository release source. The user-run companion archive separately includes its generated build and a complete integrity manifest; checksums are byte identity, not deployment approval.

Reproduce the focused baseline from repository root:

```sh
python3 scripts/release/test-release-gates.py LedgerCompanionPackagingTests ReleaseGateTests.test_path_policy ReleaseGateTests.test_site_sources_keep_archive_exclusions PackageVerificationTests
```

Run companion checks from `tools/ledger-campaign-companion/`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
COMPANION_REQUIRE_COMPILER=1 COMPANION_TEST_SOLJSON=/absolute/reviewed/soljson-v0.8.37.js node scripts/browser-regression-check.mjs
npm run build
node scripts/browser-check-production.mjs
node scripts/reproduce.mjs
```

For full clean reproduction, pass the same independently pinned `COMPANION_TEST_SOLJSON` and `COMPANION_REQUIRE_COMPILER=1` environment to `node scripts/reproduce.mjs`; otherwise optional compiler tests may be skipped and do not qualify the trusted build path.

`node scripts/reproduce.mjs` creates an isolated temporary copy, performs a clean dependency install, deterministic tests, all production bundles and test-device exclusion checks, then removes that temporary copy. Native coordinator and real-browser acceptance commands require their separately pinned checkouts/toolchain; see the corresponding acceptance scripts and `scripts/browser-README.md`.

Do not publish signed raw bytes, private recovery files, keys, APDU logs or native session state in evidence. Synthetic device/browser, disposable coordinator, live explorer/provider and physical-device categories remain distinct. Comprehensive authority and activation stay false without actual complete evidence. Alpha's initial uncommissioned state is not a global pause; no global pause exists. External audit and Sepolia remain owner-accepted omissions, not passing tests. Previous deployments and economics remain untouched.
