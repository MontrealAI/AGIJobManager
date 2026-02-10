# Testing Guide

## Canonical commands

```bash
npm install
npm run build
npm run lint
npm run size
npm test
```

## Focused execution for new deterministic suites

```bash
npx truffle test --network test \
  test/jobLifecycle.core.test.js \
  test/validatorVoting.bonds.test.js \
  test/disputes.moderator.test.js \
  test/escrowAccounting.invariants.test.js \
  test/pausing.accessControl.test.js \
  test/agiTypes.safety.test.js \
  test/ensHooks.integration.test.js \
  test/identityConfig.locking.test.js
```

## Coverage matrix (feature -> suites)

| Feature | Suites |
| --- | --- |
| Job lifecycle and terminal transitions | `jobLifecycle.core`, `escrowAccounting.invariants` |
| Validator voting / bonds / anti-double-vote | `validatorVoting.bonds` |
| Dispute paths / stale dispute recovery | `disputes.moderator` |
| Escrow solvency + withdrawable equation | `escrowAccounting.invariants` |
| Pause vs settlementPause controls | `pausing.accessControl` |
| AGIType safety and failure isolation | `agiTypes.safety` |
| ENS hooks and lock/burn behavior | `ensHooks.integration` |
| Identity wiring lock safety | `identityConfig.locking` |

## Determinism rules

- No external RPC/network dependencies.
- No wall-clock sleeps; only EVM time travel.
- Fixed and bounded loop counts for pseudo-fuzz coverage.
- Use BN math for all token/accounting assertions.
