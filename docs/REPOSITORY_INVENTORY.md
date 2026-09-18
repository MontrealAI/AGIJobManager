# Repository Inventory and Verified Commands

> v0.9.7: Contract tests use Hardhat 3 and Mocha; Truffle and Ganache have been removed. Use [Hardhat](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.7/hardhat/README.md) for public deployments and the [owner console](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.7/docs/OWNER_CONTROLS.md) for live configuration.

This file documents the current repository surface at HEAD and the canonical local/CI commands. Exact results are recorded per release and source commit.

## 1) Repository map (implementation-focused)

| Area | Path(s) | Notes |
|---|---|---|
| Core contract | `contracts/AGIJobManager.sol` | Escrow, lifecycle, voting, disputes, NFT issuance, owner controls |
| ENS integration | `contracts/ens/ENSJobPages.sol` + `contracts/ens/I*.sol` | Optional ENS hook target used by AGIJobManager best-effort calls |
| Utility libraries | `contracts/utils/*.sol` | `BondMath`, `ReputationMath`, `ENSOwnership`, `TransferUtils`, `UriUtils` |
| Public deployment | `hardhat/scripts/deploy.cjs`, `hardhat/scripts/deployment-safety.cjs` | Native-USDC preflight, paused deployment, verification and durable receipts |
| Readiness | `hardhat/scripts/check-readiness.cjs` | Read-only instance checks before owner activation |
| Local fixtures | `scripts/test-runtime.cjs`, `test/helpers/deploy.js`, `scripts/ui/run_ui_smoke_test.js` | Disposable Hardhat 3 fixtures; legacy migrations are retired |
| Post-deploy scripts | `scripts/postdeploy-config.js`, `scripts/verify-config.js` | Local-only configuration writes and read-only configuration verification |
| Bytecode checks | `scripts/check-bytecode-size.js`, `scripts/check-contract-sizes.js` | EIP-170 safety checks |
| Interface docs generator | `scripts/generate-interface-doc.js` | Re-generates interface documentation |
| Test suites | `test/*.js`, `ui-tests/*.js` | Contract behavior, invariants, ENS hooks, economic/security regressions, UI smoke |
| CI pipeline | `.github/workflows/ci.yml` | Install, lint, build, size, test, UI smoke |

## 2) package.json scripts (canonical commands)

| Purpose | Script name | Exact command |
|---|---|---|
| Build/compile | `build` | `npm --prefix hardhat run compile && node scripts/export-contract-artifacts.js` |
| Runtime size gate | `size` | `node scripts/check-bytecode-size.js` |
| Interface docs | `docs:interface` | `node scripts/generate-interface-doc.js` |
| Lint | `lint` | `solhint --max-warnings 0 "contracts/**/*.sol"` |
| Full tests | `test` | `npm run build && node scripts/test-contract-shard.js 0 1` |
| UI smoke | `test:ui` | `node scripts/ui/run_ui_smoke_test.js` |
| UI ABI export | `ui:abi` | `node scripts/ui/export_abi.js` |
| UI ABI consistency check | `ui:abi:check` | `node scripts/ui/check_ui_abi.js` |

## 3) CI command order

The contract workflow installs both lockfiles with `npm ci` and `npm --prefix hardhat ci`, then runs Solidity lint, compilation and EIP-170 checks. It runs all recursively discovered test files across four isolated shards via `npm run test:shard -- <index> 4`; every shard must succeed. Shard zero also runs the frozen USDC-console checks and browser transaction smoke test.

Separate required workflows qualify the UI, deployment/fuzz/invariant/static-analysis toolchain, documentation and actual native USDC on a local mainnet fork. [Testing](TESTING.md) maps each gate to its command and scope.

## 4) Source-specific evidence

The release archive includes `VALIDATION.md`, `SOURCE_CI.json`, `RELEASE_MANIFEST.json` and `SHA256SUMS.txt`. The manifest identifies the exact application commit/tree; CI links identify successful source-specific runs. Rebuild with the committed compiler configuration and lockfiles before comparing artifacts.

Avoid carrying test counts or bytecode sizes forward from earlier releases as current evidence. The application ABI is generated from the current source; [mainnet readiness](MAINNET_READINESS.md) distinguishes software qualification from instance-specific deployment checks.

## 5) Contract surface references

For complete callable/API behavior and event/error references, see:
- `docs/AGIJobManager_Interface.md`
- `docs/PROTOCOL_FLOW.md`
- `docs/CONFIGURATION.md`
- Source of truth: `contracts/AGIJobManager.sol`
