# v0.9.3 validation

Frozen application commit: `d681493cb824f2d855fe62fe6b1f0dfb0f2fab27`.

Application tree: `44e1a0acb37abc1207aa441cf67acc1813e2fb3b`.

## Exact-source gates

Publication requires every job in the five source workflows to pass. Each job checks out the frozen commit, verifies `git rev-parse HEAD`, and emits an anchored source marker. The publisher downloads all eight required job logs and requires exactly one matching marker plus the successful checkout assertion step. Repository, workflow, source, complete job sets and tree identity are also checked. Missing or expired evidence blocks publication.

| Gate | Source run | Coverage |
| --- | --- | --- |
| Documentation | [35271284819](https://github.com/MontrealAI/AGIJobManager/actions/runs/35271284819) | Generated references, ENS docs, links and repository checks |
| Contract CI | [35271284773](https://github.com/MontrealAI/AGIJobManager/actions/runs/35271284773) | Four regression shards, strict lint/build, bytecode limits and console/local-EVM smoke |
| UI CI | [35271284639](https://github.com/MontrealAI/AGIJobManager/actions/runs/35271284639) | Full dependency audit, lint/types, unit/property/browser/accessibility/header tests and deterministic artifacts |
| Native USDC and ENS forks | [35271284714](https://github.com/MontrealAI/AGIJobManager/actions/runs/35271284714) | 8 native-USDC cases and 19 source-bound cutover/membership scenarios |
| Security verification | [35271284744](https://github.com/MontrealAI/AGIJobManager/actions/runs/35271284744) | Full root/deployment audits, deployment/recovery cases, compiler compatibility, Foundry and Slither review |

## Release-specific review

Production Solidity and compiler settings are unchanged from v0.9.2. The ENS resolver API correction was first published in v0.9.2; v0.9.3 retains it. Deployment code now requires a reviewed local profile instead of silently selecting the example. Example owner/recipient addresses are blank, and nonzero historical Merkle exception roots are no longer copied by default. The four established mainnet membership roots remain explicit and labeled.

ENS helper deployment requires a reviewed owner, source verification for broadcasts, paused manager intake and accepted manager ownership. Sepolia requires explicit ENS dependency addresses. The helper records its exact compiler input and runtime identity for recovery. Read-only readiness explains membership routes and its limited point-in-time scope; it does not certify individual participants, all mutable policy settings or production signer access.

The guides now distinguish Agent/Club membership from optional job pages, describe separate manager/helper/ENS-parent authorities, preserve existing jobs, and route users to the versioned USDC console. Setup commands preserve existing operator files. Retired commands, incorrect lock descriptions and misleading recovery instructions were corrected. Merkle documentation permits a valid empty proof for a single-leaf tree.

A keyless `DRY_RUN=1` mainnet deployment plan also completed against public RPC at block 25999593 (`0x7ea7aa4558f4ec1a77bfe124969ce38a09e66293d72e4491217bf94b3da259f8`). It used explicitly labeled fixture owner/recipient/deployer addresses, no signing key and no mainnet confirmation phrase. The plan checked native USDC, deployed ENS dependencies, compiler/artifacts and labeled all four membership roots; it broadcast no transactions. This exercises the actual script read path, not the intended production configuration.

## Measured coverage

| Area | Passing coverage |
| --- | --- |
| Contract regressions | 419 cases across four shards |
| Deployment | 85 preflight/readiness/verifier cases and 10 actual deployment/size cases |
| Actual-mainnet local forks | 8 original USDC cases and 19 cutover scenarios, including 7 new ENS membership scenarios |
| Foundry | 36 unit/fuzz/invariant tests; 256 fuzz samples, four 64 × 64 stateful invariants and one directed lifecycle invariant |
| UI | 177 unit cases, 6 property cases, 9 browser flows, 4 accessibility cases, 2 header cases and 35 primary-console checks |
| Release gates | 27 source-evidence/asset-upload tests, duplicate deterministic packages and uploaded asset digest checks |

The invariant suite includes 16,384 stateful calls. The reviewed all-detector inventory remains unchanged, and compiler output retains zero warnings. Tests using mocks are not presented as live-wallet or production-NFT qualification.

The cutover suite runs at Ethereum block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`. It verifies the actual legacy manager, native USDC implementation and real ENS dependencies. A separate original USDC suite pins block 25,997,388. Every transaction occurs on an isolated local fork; public-network execution is rejected.

Membership scenarios use new local child-name fixtures under the observed primary and alpha Agent/Club roots. They exercise wrapped ownership, resolver address claims, approvals, revocation, wrong-root/unrelated rejection and the preserved owner allowlist/Merkle exceptions. A transferred-away identity blocks new admission while assigned jobs retain their existing exit path. Test wallets and a mock NFT credential are explicit limitations; this is not verification of actual production members or the final NFT policy.

The source-bound machine report at `source/docs/qualification/mainnet-cutover.json` includes ENS code hashes, observed parent authority, the dedicated job namespace, assertions and legacy inventory. CI reruns the suite and compares the complete report byte-for-byte. All 12 allocated legacy job IDs, original-token balances/allowances, reserves, ownership, ENS wiring/records and six completion NFTs remain equal through new-system lifecycles. A separate scenario exercises the original-asset exit of legacy job 11 without changing the new manager. This is an explicit inventory, not a formal proof over arbitrary storage.

## Security and deployment limits

The required CI audits include all root, Hardhat and UI dependencies, including development dependencies, at every advisory severity. Advisory results describe the qualification date.

The source-bound Slither review retains **116 distinct findings: 0 high, 7 medium, 36 low, 71 informational and 2 optimization**. The overlapping reports contain 7 extended, 30 reentrancy and 116 complete-inventory entries. No finding is hidden or relabeled as repaired. The only reviewed lockfile change is the application version; the dependency graph and production Solidity are unchanged. Existing UI deprecations and documented compiler/lint exceptions remain visible. See `source/docs/security/v0.9.1-static-analysis.md` and `source/docs/security/v0.9.1-ui-tooling.md` for their dispositions.

The qualified Solidity 0.8.37 profile uses via IR, optimizer 40 runs, Shanghai, no metadata bytecode hash and stripped revert strings. AGIJobManager runtime remains **24,409 bytes**, leaving **167 bytes** below EIP-170; ENSJobPages remains **15,344 bytes**. Local deployment tests enforce runtime/initcode/gas limits with actual constructor inputs. These measurements are not live receipts or approval of arbitrary configuration.

ENS hooks remain best-effort. The exercised short metadata does not establish that maximum permitted specification/completion URIs fit the bounded 500,000-gas hook budget. Operators must verify actual events, records and terminal delegation revocation.

## Release integrity and activation boundary

The packager binds the frozen commit/tree, exact file delta since v0.9.2, evidence digests, and historical records preserved against v0.9.2 publication commit `2013b3bb09246faf665150a166c36ed196ab4a2c`. It verifies ancestry and protected paths, inventories every payload with SHA-256 and produces identical archives twice.

The publisher uploads using the known draft release ID with bounded timeouts/retries. An ambiguous response is reconciled by exact asset name, size and digest; mismatches are never overwritten. All four uploaded assets are checked before publication. Existing tags and published releases are never replaced. Publication preparation may change only this release's documents, release tooling and its workflow; the qualified application remains frozen.

This release does not deploy, activate, repoint or migrate any live contract, job or funds. Actual owners/recipients, signing access, intended eligibility and policy, operating rehearsal, independent review appropriate to exposure, source verification and live instance readiness remain prerequisites for production activation. The pinned fork proves local contract behavior, not control of production signing keys or present-day chain state.

## Reproduce the release assets

Use a full Git checkout at the commit of the successful **USDC Release v0.9.3** publication workflow. That publication commit adds the release metadata and tooling after the application source was frozen. The application tag alone and an extracted ZIP do not contain the Git history required by the packager.

From that repository checkout, run `python3 scripts/release/package-release.py --out /tmp/v093-rebuild-a`, then run it again with `--out /tmp/v093-rebuild-b` and compare the directories with `diff -r /tmp/v093-rebuild-a /tmp/v093-rebuild-b`. Both output directories must be new and empty. Compare the resulting checksums with the published assets. Packaging is local and does not publish or deploy anything.
