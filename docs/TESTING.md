# Testing v1.0.0

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
| Genesis worked example | Current contracts with archived historical inputs and explicit scenario assumptions | `npm run simulate:genesis` | 24 local scenarios: exact economics, review boundaries, buyer/agent dispute outcomes, claims, ENS failure and credential loss; see [scope and reproduction](examples/GENESIS_JOB_TODAY.md#reproduce-the-simulation) |
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
| Primary USDC console | Current single-file console guards and browser journeys | `node scripts/ui/verify-usdc-console.mjs` and `npm run test:ui:usdc` | Exact repository HTML, mocked wallet/RPC, context changes, onboarding and mobile behavior; no signing/broadcast |
| Standalone builds | Next.js artifact reproducibility | From `ui/`: `npm run verify:deterministic` and `npm run verify:committed-html` | Byte-for-byte committed build freshness |
| Documentation | Generated references and links | `npm run docs:check` | API/version freshness and documentation integrity |
| Dependency audit | Full root, deployment and UI dependency trees | `npm audit --audit-level=low`; repeat with `npm --prefix hardhat audit --audit-level=low` and `npm --prefix ui audit --audit-level=low` | Any reported severity blocks the gate, including development dependencies |

## Reproduce the required gates

Use Node 22.23.2 and `npm ci` in the root, `hardhat/` and `ui/` workspaces. Compile before deployment tests. Install the Foundry and Slither versions pinned in [Security Verification](../.github/workflows/security-verification.yml). Install browser dependencies with `npx playwright install --with-deps chromium` in `ui/` before browser suites.

For the primary console browser suite, also install Chromium from the repository root with `npx playwright install --with-deps chromium`. The runner fetches the console’s integrity-pinned Web3 dependency; `AGIJOBMANAGER_WEB3_PATH` may point to a local copy with the same required digest. Skipped tests, focused tests and expected failures do not qualify.

[Current source differs from the frozen v1.0.0 download](V1_RELEASE_SCOPE.md#published-download-versus-current-source). The frozen release uses its recorded `scripts/release/verify-usdc-ui.mjs`; use the current console verifier above for `main`. Historical CI results qualify their recorded source, not later edits.

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
