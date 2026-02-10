# Testing Guide

## Test stack
- Truffle test runner
- In-process Ganache provider (`network: test`) from `truffle-config.js`
- Contract and script checks chained by npm scripts

## Commands
```bash
npm ci
npm run build
npm test
npm run size
```

## What `npm test` covers
- Compile all contracts (`truffle compile --all`)
- Run Truffle tests (`truffle test --network test`)
- Execute legacy script-style test (`node test/AGIJobManager.test.js`)
- Enforce runtime size checks for all artifacts (`node scripts/check-contract-sizes.js`)

## Bytecode size guard
- `npm run size` runs `scripts/check-bytecode-size.js` (default target `AGIJobManager`) with max runtime 24,575 bytes.
- `scripts/check-contract-sizes.js` scans all artifacts against the same threshold.
- Keep ABI stability and avoid unnecessary runtime growth.

## Test layout
Representative suites in `test/`:
- Lifecycle/happy path: `happyPath.test.js`, `AGIJobManager.full.test.js`
- Economic safety/invariants: `economicSafety.test.js`, `escrowAccounting.test.js`, `invariants.solvency.test.js`, `completionSettlementInvariant.test.js`
- Disputes/security: `disputeHardening.test.js`, `securityRegression.test.js`, `delistJob.reentrancy.test.js`
- ENS/namespace: `ensJobPagesHooks.test.js`, `namespaceAlpha.test.js`, `ensJobPagesHelper.test.js`
- Admin/config: `adminOps.test.js`, `deploymentDefaults.test.js`, `deploymentWiring.test.js`, `validate-params-script.test.js`
- UI/indexer checks: `ui_abi_sync.test.js`, `ui_error_decoder.test.js`

## Adding tests
- Prefer focused spec files in `test/` by concern area.
- Reuse helpers in `test/helpers/`.
- For ENS and ERC token edge cases, use mocks in `contracts/test/`.
- Assert both state and events for settlement-critical paths.

## Mainnet-fork tests
No dedicated mainnet-fork script is defined in `package.json` in this repo. If forks are added later, document exact command and RPC requirements before use.
