# Testing

## Test structure
- `test/*.test.js`: core contract behavior, invariants, security regressions, economics, deployment wiring.
- `ui-tests/*`: UI smoke/indexer-focused checks.
- `contracts/test/*`: mocks and harness contracts used by tests.

Representative suites:
- lifecycle/state machine (`AGIJobManager.*`, `happyPath`, `jobStatus`)
- escrow/solvency/invariants (`escrowAccounting`, `invariants.solvency`, `economicSafety`)
- disputes/validators (`disputeHardening`, `validatorCap`, `livenessTimeouts`)
- ENS hooks (`ensJobPagesHooks`, `ensJobPagesHelper`)
- size/deployment checks (`bytecodeSize`, `deployment*`, `validate-params-script`)

## Standard commands
```bash
npm run build
npm test
npm run size
```

## Bytecode size guard
- `npm run size` executes `scripts/check-bytecode-size.js`.
- Guard threshold is 24,575 bytes runtime (`AGIJobManager` by default) to stay under EIP-170 deploy limit.
- `npm test` also executes `scripts/check-contract-sizes.js` for all artifacts.

## Adding new tests
- Prefer focused regression tests per behavior class.
- Reuse existing mocks in `contracts/test/`.
- Keep checks deterministic and assert both state and events for settlement paths.
