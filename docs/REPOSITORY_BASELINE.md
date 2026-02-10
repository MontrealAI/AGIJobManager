# Repository Baseline (HEAD Grounding)

This document records the repository inventory and executable command surface as of current `HEAD`.

## Repository inventory

- **Core contracts**
  - `contracts/AGIJobManager.sol`
  - `contracts/ens/ENSJobPages.sol`
  - `contracts/utils/*.sol`
- **Deployment**
  - `migrations/2_deploy_contracts.js`
  - `migrations/deploy-config.js`
  - `scripts/postdeploy-config.js`
  - `scripts/verify-config.js`
- **Tests**
  - `test/*.test.js` (Truffle/Mocha suites)
  - `test/AGIJobManager.test.js` (node-executed test entry used in `npm run test`)
  - `ui-tests/` (UI ABI and smoke checks)
- **CI workflow**
  - `.github/workflows/ci.yml`

## package.json scripts (source of truth)

| Purpose | Command | Backing script |
|---|---|---|
| Install dependencies | `npm install` | npm default install behavior |
| Compile/build | `npm run build` | `truffle compile` |
| Full canonical test pipeline | `npm run test` | `truffle compile --all && truffle test --network test && node test/AGIJobManager.test.js && node scripts/check-contract-sizes.js` |
| Lint Solidity | `npm run lint` | `solhint "contracts/**/*.sol"` |
| Bytecode size check | `npm run size` | `node scripts/check-bytecode-size.js` |

## Deployment command surface

- `truffle migrate --network <network>` runs `migrations/2_deploy_contracts.js` and constructor wiring from `migrations/deploy-config.js`.
- Post-deploy configuration and verification:
  - `truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>`
  - `truffle exec scripts/verify-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>`

## Local verification executed

The following commands were run locally against this repository state:

1. `npm install`
2. `npm run build`
3. `npm run test`

Observed results:
- Build completed successfully on `solc 0.8.23` (Truffle compiler pin).
- Full test pipeline passed (`260 passing`).
- `scripts/check-contract-sizes.js` reported `AGIJobManager deployedBytecode size: 24574 bytes`.
