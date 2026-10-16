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

The primary configuration workflow uses the owner's existing Ledger-backed wallet with Etherscan. Initial creation is separate; the custom companion is optional for creation/recovery and is not a prerequisite for wallet-supported calls. Exact call review and independent canonical receipt/post-state acceptance are separate from native signing-journal completion. Synthetic wallet transaction fixtures cannot establish a physical signature or real Mainnet authority.

## Frozen implementation checkpoint

The required official-soljson plus native-compiler Linux deterministic suite passed **428/428, zero failures and zero skips**. Production bundles and synthetic-device exclusion passed. These checks are implementation evidence; they are not physical Mac/Ledger, live provider, explorer or deployment approval.

Actual Manager `c2f72180…` coordinator mechanics passed nine operations with nine runtime proofs, trusted source/compiler reproduction and designated-governor core authority observations on the disposable fixture. The fixture uses zero ENS roots/mock dependencies, so production remains blocked for the known root-order defect. Actual Alpha `38064bec…` mechanics passed seven operations with a synthetic fixture governor and five runtime proofs; separate designated-governor unsigned checks and five initial contracts were checked with both bindings unset. **No designated-governor physical signatures occurred.** Old source entries and evidence remain preserved; see `COORDINATOR_COMPATIBILITY.json` for exact acceptance pins/scopes.

The direct wallet-policy helper independently reproduced all five Alpha native contract outputs and their 55-source closure offline with the official compiler, with zero network/signatures/broadcasts. Optional creator-preparation acceptance passed the actual Linux native planners (Manager nine replanned creations, Alpha seven reviewed operations). Real Mac CLI/device/provider acceptance remains separate. The standalone five-creation wallet receipt collector's exact final result is recorded in the external decision/evidence report; it does not require native binding imports or a seven-step journal.

A raw TCP browser preconnect with no HTTP request reproduced a shutdown hang on the e09 checkpoint. The HTTP server now tracks accepted sockets, closes idle/preconnect sockets during shutdown and drains accepted API requests before closing their sockets. The two new actual HTTP regression cases passed with the seven existing cases; independent focused review passed 61/61. This correction does not change signing/relay semantics or native accepted code closures. The unchanged 48 browser cases now write atomic progress and have a 60-second watchdog; earlier incomplete runs remain failures, not browser passes.

The initial Mac browser checkpoint `221eb222…` passed 46 cases and failed two; its subsequent UI correction requires a fresh exact-head rerun. The final immutable implementation head/tree, real-browser count and final source-archive qualification are recorded externally in `decision.json`/HTML. Do not relabel the initial attempt as a full pass.

## Exact-source blocker recorded during review

Manager candidate `c2f72180d2f0d6ecd5b92d8e5197c5344be2c699` reverses the `agentRootNode` and `alphaClubRootNode` getter expectations relative to contract initialization in the native core-creation verifier. Distinct nonzero ENS roots therefore reject the correct deployed state. The same defect also affects the retained legacy Manager source. The production launcher blocks all supported Manager revisions; historical adapters/evidence remain for recovery and fixtures and are not a production fallback. An all-zero-root generic-engine fixture qualifies transport/recovery only and cannot qualify that policy or a live production launch. The implementation owner must correct the native verifier, freeze a new exact revision and rerun native plus companion acceptance with distinct nonzero roots. Do not change eligibility policy or choose equal/zero roots to bypass this defect. The separate deployment decision report records whether a later corrected source was actually supplied and qualified.

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
