# Repository Inventory and Verified Commands

This file documents the current repository surface at HEAD and the canonical local/CI commands that were verified against the codebase.

## 1) Repository map (implementation-focused)

| Area | Path(s) | Notes |
|---|---|---|
| Core contract | `contracts/AGIJobManager.sol` | Escrow, lifecycle, voting, disputes, NFT issuance, owner controls |
| ENS integration | `contracts/ens/ENSJobPages.sol` + `contracts/ens/I*.sol` | Optional ENS hook target used by AGIJobManager best-effort calls |
| Utility libraries | `contracts/utils/*.sol` | `BondMath`, `ReputationMath`, `ENSOwnership`, `TransferUtils`, `UriUtils` |
| Deployment | `migrations/2_deploy_contracts.js`, `migrations/deploy-config.js` | Truffle deployment + network/environment wiring |
| Post-deploy scripts | `scripts/postdeploy-config.js`, `scripts/verify-config.js` | Configure and verify runtime settings |
| Bytecode checks | `scripts/check-bytecode-size.js`, `scripts/check-contract-sizes.js` | EIP-170 safety checks |
| Interface docs generator | `scripts/generate-interface-doc.js` | Re-generates interface documentation |
| Test suites | `test/*.js`, `ui-tests/*.js` | Contract behavior, invariants, ENS hooks, economic/security regressions, UI smoke |
| CI pipeline | `.github/workflows/ci.yml` | Install, lint, build, size, test, UI smoke |

## 2) package.json scripts (canonical commands)

| Purpose | Script name | Exact command |
|---|---|---|
| Build/compile | `build` | `truffle compile` |
| Runtime size gate | `size` | `node scripts/check-bytecode-size.js` |
| Interface docs | `docs:interface` | `node scripts/generate-interface-doc.js` |
| Lint | `lint` | `solhint "contracts/**/*.sol"` |
| Full tests | `test` | `truffle compile --all && truffle test --network test && node test/AGIJobManager.test.js && node scripts/check-contract-sizes.js` |
| UI smoke | `test:ui` | `node scripts/ui/run_ui_smoke_test.js` |
| UI ABI export | `ui:abi` | `node scripts/ui/export_abi.js` |
| UI ABI consistency check | `ui:abi:check` | `node scripts/ui/check_ui_abi.js` |

## 3) CI command order

From `.github/workflows/ci.yml`:
1. `npm install`
2. `npx playwright install --with-deps chromium`
3. `npm run lint`
4. `npm run build`
5. `npm run size`
6. `npm run test`
7. `npm run test:ui`

## 4) Verified local execution

The following canonical commands were executed locally:

- `npm install`
- `npm run build`
- `npm run test`

Observed outcomes:
- Build compiled successfully with solc `0.8.23` via Truffle.
- Full test command completed successfully with **260 passing** tests.
- Bytecode size report includes `AGIJobManager deployedBytecode size: 24574 bytes` (under EIP-170 cap of 24576 bytes).

## 5) Contract surface references

For complete callable/API behavior and event/error references, see:
- `docs/AGIJobManager_Interface.md`
- `docs/PROTOCOL_FLOW.md`
- `docs/CONFIGURATION.md`
- Source of truth: `contracts/AGIJobManager.sol`
