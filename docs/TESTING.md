# Testing v0.9.3

## Current strategy

- JavaScript suites under [`test/`](../test) cover lifecycle, accounting, disputes, role gates, ENS hooks, and regressions. They run on the maintained Hardhat 3 local EDR chain with ethers-backed compatibility helpers; Truffle and Ganache are no longer dependencies.
- Foundry suites under [`forge-test/`](../forge-test) provide fuzz/invariant hardening.
- UI smoke checks validate ABI sync and front-end critical path. UI unit and browser suites test transaction context, failed receipts, accessibility and response headers.
- Hardhat tests cover deployment preflight, partial failures, ownership and readiness. The separate mainnet-fork gate exercises actual Circle USDC at a pinned historical block without broadcasting.
- Every release records successful CI run IDs for its exact source commit. The publisher rechecks those IDs, source/tree identities and asset digests before publication. See the release's `VALIDATION.md` for measured results; this page describes commands, not an independent audit.

## Test matrix

| Suite | Purpose | Command | Validates |
| --- | --- | --- | --- |
| Contract suite | Hardhat compile, artifact export, existing JavaScript regressions and bytecode guard | `npm test` | Core protocol behavior; uses disposable local accounts |
| Contract CI shards | Same recursively discovered test files, four isolated runners | `npm run test:shard -- 0 4` through `3 4`, after `npm run build` | Complete file coverage with isolated chain state; all four shards are required |
| Lint lane | Solidity lint rules | `npm run lint` | Style/safety linting |
| Bytecode lane | EIP-170 guardrail | `npm run size` | Deployability constraints |
| UI smoke lane | Contract/UI integration sanity | `npm run test:ui` | ABI + flow coherence |
| Foundry build | Compiler and Forge lint with warnings treated as failures | `FOUNDRY_PROFILE=ci forge build --deny warnings` | Newly introduced diagnostics fail; reviewed line-specific annotations retain their explicit scope |
| Foundry tests | Fuzz and stateful invariants | `FOUNDRY_PROFILE=ci forge test` | Payout/reserve conservation, owner-change snapshots and terminal settlement |
| Deployment preflight | Configuration and tool failure handling | `npm --prefix hardhat run test:preflight` | Fail-closed inputs, verification and receipt handling |
| Local deployment | Actual deployment/readiness cases | `npm --prefix hardhat run test:deployment` | Paused construction, exact code, ownership, recovery and EVM size limits |
| Native-USDC fork | Actual historical Ethereum token behavior | `npm --prefix hardhat run test:mainnet-fork` | Ordered settlement and issuer pause/blocklist rollback/retry |
| USDC/ENS cutover fork | Real ENS participant membership, wrapped-root job pages and original-job preservation | `CUTOVER_REPORT=../build/qualification/mainnet-cutover.json npm --prefix hardhat run test:cutover` | Primary/alpha role admission and rejection; explicit exceptions; USDC settlement/recovery; legacy inventory and original-asset exit |
| Static analysis | Configured scan and source-bound extended review | `npm run slither` and `npm run slither:extended` | Retained findings with explicit rationale; new or changed findings fail the gate |
| UI unit | Interface behavior and transaction guards | `npm --prefix ui test` | Amounts, wallet/network changes, review and failed receipt handling |
| UI browsers | User flow, accessibility and headers | From `ui/`: `npm run test:e2e`, `npm run test:a11y`, `npm run test:headers` | Browser behavior against the configured demo/test setup |
| Standalone builds | Frozen-console checks and reproducibility | `node scripts/release/verify-usdc-ui.mjs`; from `ui/`: `npm run verify:deterministic` and `npm run verify:committed-html` | Console regressions and byte-for-byte committed build freshness |
| Documentation | Generated references and links | `npm run docs:check` | API/version freshness and documentation integrity |
| Dependency audit | Full root, deployment and UI dependency trees | `npm audit --audit-level=low`; repeat with `npm --prefix hardhat audit --audit-level=low` and `npm --prefix ui audit --audit-level=low` | Any reported severity blocks the gate, including development dependencies |

## Reproduce the required gates

Use Node 22.23.2 and `npm ci` in the root, `hardhat/` and `ui/` workspaces. Compile before deployment tests. Install the Foundry and Slither versions pinned in [Security Verification](../.github/workflows/security-verification.yml). Install browser dependencies with `npx playwright install --with-deps chromium` in `ui/` before browser suites.

Compiler version and optimizer/EVM settings are pinned in [Hardhat configuration](../hardhat/hardhat.config.js), [Foundry configuration](../foundry.toml) and the root lockfile. Preserve their parity when changing compiler versions. The tested runtime size and exact compiler profile belong in the final release evidence; historical size or pass counts do not qualify a new source tree.

Run the full dependency gates after clean installs:

```bash
npm audit --audit-level=low
npm --prefix hardhat audit --audit-level=low
npm --prefix ui audit --audit-level=low
```

Do not omit development dependencies or raise the severity threshold to obtain a passing result. An unavailable advisory service is not evidence of a clean audit. See [dependency scope](DEPENDENCY_SECURITY.md).

Foundry and static analysis are mandatory CI gates, not optional release hardening. [CI](../.github/workflows/ci.yml), [UI CI](../.github/workflows/ui.yml), [Security Verification](../.github/workflows/security-verification.yml), [Docs Integrity](../.github/workflows/docs.yml) and [Mainnet USDC Fork Qualification](../.github/workflows/mainnet-fork.yml) define the authoritative commands. Follow [mainnet readiness](MAINNET_READINESS.md) for the end-to-end qualification sequence.

Local regression and fork tests use disposable accounts. Historical Solidity comparison fixtures retain intentionally unsafe behavior, with line-specific rationale; they must not be deployed. A fork test proves behavior at its pinned block; deployment preflight must recheck current USDC and instance state. Measured pass counts, audits and run links are recorded only for the final qualified release source.
