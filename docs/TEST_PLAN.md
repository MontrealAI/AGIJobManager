# Test plan

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

This plan describes required coverage and how to reproduce it. Successful runs, exact test counts, compiler identity and runtime sizes are recorded in the final release's validation evidence for its frozen source commit.

## Toolchain and source coverage

Use Node 22.23.2 and the committed lockfiles in the root, `hardhat/` and `ui/` workspaces. The contract regression runner uses Hardhat 3's local EDR chain, ethers and compatibility helpers for the existing JavaScript suites. The migration removes Truffle and Ganache dependencies while retaining the regression cases and assertions.

The authoritative compiler settings are [hardhat/hardhat.config.js](../hardhat/hardhat.config.js) and [foundry.toml](../foundry.toml), with the compiler package pinned in the root lockfile. Both build paths must use the qualified profile. Never substitute compiler, optimizer or EVM settings from an earlier release to bypass a size failure.

The root commands are:

| Command | Required result |
| --- | --- |
| `npm run build` | Hardhat compilation and exported artifacts for the JavaScript regression runner |
| `npm run lint` | Solidity lint passes |
| `npm run size` | Production runtime bytecode remains within Ethereum's EIP-170 limit |
| `npm test` | Existing regression suites and contract size assertions pass |
| `npm run test:shard -- 0 4` through `3 4` | Every recursively discovered regression file belongs to one of the four required CI shards |
| `npm run test:ui` | Contract ABI and browser transaction smoke checks pass |

Compile before invoking individual shards. Do not replace the discovered file list with a handpicked subset. Regression helpers and the standalone contract checks remain part of the runner's contract.

## Required execution

From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm --prefix ui ci
npm audit --audit-level=low
npm --prefix hardhat audit --audit-level=low
npm --prefix ui audit --audit-level=low
npm run lint
npm test
npm run size
FOUNDRY_PROFILE=ci forge build --deny warnings
FOUNDRY_PROFILE=ci forge test
npm --prefix hardhat run test:preflight
npm --prefix hardhat run test:deployment
npm --prefix hardhat run test:mainnet-fork
```

Install the pinned Foundry/Slither tools and browser prerequisites as described in [TESTING.md](TESTING.md). Full dependency audits include development packages and fail at the low threshold. A network error or missing audit evidence must not be treated as a pass.

The complete release also requires configured static analysis, UI unit/property/browser/accessibility/header suites, reproducible standalone builds, documentation checks and release evidence validation. [TESTING.md](TESTING.md) maps these commands to the five authoritative CI workflows.

## Deterministic execution model

The JavaScript suites use local disposable accounts and mocked ENS contracts. Compatibility helpers expose controlled local time and JSON-RPC operations to the preserved suites. Foundry tests use `vm.warp` for exact deadline and lifecycle boundaries. No test requires production signing keys.

The separate actual-USDC suite reads a pinned historical Ethereum block into a local Hardhat fork. It verifies the expected issuer implementation and state before exercising settlement. It requires archive RPC access and fails when that evidence cannot be obtained; it does not send transactions to Ethereum mainnet or establish current issuer state.

## Coverage mapped to protocol risks

| Area | Existing suites | Required behavior |
| --- | --- | --- |
| Job lifecycle | `test/jobLifecycle.core.test.js`, `test/livenessTimeouts.test.js` | Create/apply/completion/finalize/expire boundaries, no-vote paths and challenge windows |
| Solvency and payouts | `test/escrowAccounting.invariants.test.js`, `test/validatorVoting.bonds.test.js`, `forge-test/fuzz/AGIJobManagerSettlementFuzz.t.sol` | Exact USDC flows, separate bonds, ordered validator/wallet/agent payments and reserve conservation |
| Disputes | `test/disputeHardening.test.js`, `test/disputes.moderator.test.js` | Bond handling, moderator authorization, stale-dispute recovery and terminal accounting |
| Owner controls | `test/pausing.accessControl.test.js`, `test/identityConfig.locking.test.js` | Pause semantics, protected identity changes and guarded authority |
| Identity and ENS | `test/ensHooks.integration.test.js`, `test/ensJobPagesHelper.test.js`, `test/namespaceAlpha.test.js` | Namespace authorization, strict external returndata handling and isolated hook failures |
| Adversarial dependencies | `test/agiTypes.safety.test.js`, `forge-test/unit/AGIJobManagerSecurityVerification.t.sol` | Reentrancy and malformed/reverting NFT, token and ENS behavior cannot corrupt core accounting |
| Stateful lifecycle | `forge-test/invariant/` | Reserve identities hold across generated transitions; directed lifecycle drain reaches terminal states and clears reserves |
| Deployment recovery | `hardhat/test/deployment-preflight.test.cjs`, `hardhat/test/deployment-readiness.test.cjs` | Invalid inputs fail closed, receipt and linked-code identity stay bound, and recovery preserves broadcast evidence |

Historical comparison contracts under `contracts/legacy/` deliberately retain original defects used by regression tests. Their line-specific lint acknowledgments document fixture behavior; they are not repairs or approval to deploy those contracts. Test-clock acknowledgments explain controlled timing, and new unacknowledged compiler or Forge warnings fail `--deny warnings`.

## Release acceptance

All required shards and workflows must succeed for the exact final application source. Preserve the inventory, review any compatibility-helper change against the assertions it supports, and resolve failures rather than weakening test expectations or skipping cases. Final release evidence must bind the source/tree, workflow and job results, dependency audits, bytecode sizes and artifact digests. A prior release's passing totals do not satisfy this gate.
