# Testing Guide

## Purpose
Document test suite structure, commands, and extension practices.

## Audience
Contributors and release engineers.

## Preconditions / assumptions
- Run from repository root after `npm ci`.

## Canonical commands
```bash
npm run build
npm test
npm run size
npm run test:ui
```

## What `npm test` executes
From `package.json`:
1. `truffle compile --all`
2. `truffle test --network test`
3. `node test/AGIJobManager.test.js`
4. `node scripts/check-contract-sizes.js`

## Test suite map
| Area | Representative files |
|---|---|
| Lifecycle and state machine | `test/happyPath.test.js`, `test/jobStatus.test.js`, `test/scenarioEconomicStateMachine.test.js` |
| Escrow and solvency | `test/escrowAccounting.test.js`, `test/invariants.solvency.test.js`, `test/completionSettlementInvariant.test.js` |
| Disputes and validators | `test/disputeHardening.test.js`, `test/validatorCap.test.js`, `test/livenessTimeouts.test.js` |
| Security regression | `test/securityRegression.test.js`, `test/delistJob.reentrancy.test.js`, `test/economicSafety.test.js` |
| ENS integration | `test/ensJobPagesHooks.test.js`, `test/ensJobPagesHelper.test.js` |
| Deployment/config checks | `test/deploymentDefaults.test.js`, `test/deploymentWiring.test.js`, `test/validate-params-script.test.js` |

## Bytecode size guard behavior
- `scripts/check-bytecode-size.js`: strict target guard (default `AGIJobManager`) with max `24575` bytes.
- `scripts/check-contract-sizes.js`: reports all compiled artifacts and fails if any exceed max.

## Writing new tests
- Reuse mocks in `contracts/test/` and helper utilities in `test/helpers/`.
- Assert both state changes and emitted events for settlement-critical flows.
- Prefer deterministic values and explicit time manipulation in timeout paths.

## Gotchas / failure modes
- Running `truffle test` against non-test networks can produce false negatives due to config/funding assumptions.
- Size checks require fresh artifacts; run compile before size scripts.

## References
- [`../package.json`](../package.json)
- [`../scripts/check-bytecode-size.js`](../scripts/check-bytecode-size.js)
- [`../scripts/check-contract-sizes.js`](../scripts/check-contract-sizes.js)
- [`../test`](../test)
