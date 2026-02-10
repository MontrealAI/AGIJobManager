# Testing Guide

## Purpose
Explain test structure and canonical commands.

## Audience
Contributors and reviewers.

## Canonical Commands
```bash
npm run build
npm run size
npm test
```

## Test Structure
- Broad end-to-end and regression suites: `test/AGIJobManager.*.test.js`
- Security/economic invariants: `test/securityRegression.test.js`, `test/escrowAccounting.test.js`, `test/economicSafety.test.js`, `test/invariants.*`
- ENS hooks and identity behavior: `test/ensJobPagesHooks.test.js`, `test/namespaceAlpha.test.js`
- Operational scripts coverage: `test/validate-params-script.test.js`, ABI/UI sync tests

## Bytecode Guard Interpretation
- `scripts/check-bytecode-size.js` enforces deployable runtime cap for configured targets.
- `scripts/check-contract-sizes.js` prints all contract runtime sizes and fails if oversized.

## Writing New Tests
- Prefer existing helpers in `test/helpers/*`.
- Keep tests deterministic on Truffle `test` network.
- Add scenario coverage for both happy path and dispute/timeout paths.

## Testnet / Fork Notes
- Repo includes `sepolia` and `mainnet` network definitions; most CI/local validation should stay on `test` network.

## Gotchas
- `npm test` executes additional node scripts beyond `truffle test`.
- Avoid relying on wall-clock assumptions not controlled by test helpers.

## References
- [`../package.json`](../package.json)
- [`../test`](../test)
- [`../scripts/check-bytecode-size.js`](../scripts/check-bytecode-size.js)
