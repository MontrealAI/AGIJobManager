# Security Testing Runbook

Use deterministic installs before all checks:

```bash
npm ci
```

## Required checks

```bash
npm test
FOUNDRY_PROFILE=ci forge test
npm run slither
npm run slither:extended
```

## Expected outcomes

- Truffle unit/integration suite passes and bytecode size guard remains below EIP-170.
- Foundry fuzz + invariants pass without invariant violations.
- The configured Slither scan has no unaccepted medium/high findings; the mandatory extended scan retains every reviewed finding and fails on source/baseline drift or new/changed findings. A passing review gate is not a zero-findings claim.

## Echidna

This repository relies on Foundry invariant tests as the primary property-testing layer.

## Slither configuration notes

`slither.config.json` suppresses a small set of noisy detectors for this repository:

- `reentrancy-*` and `reentrancy-balance`: core settlement/auth entrypoints are already guarded (`nonReentrant`) and covered by regression/invariant suites.
- `divide-before-multiply`: used in bounded bond/reward math with explicit caps and dedicated tests.
- `mapping-deletion`: expected for deleting job structs containing mappings after terminal settlement.
- `uninitialized-local`: false positives on Solidity default-initialized locals.
- `unused-return`: intentional best-effort ENS/namewrapper interactions where failures must not brick core flows.

## Mandatory extended gates

Use `npm run slither:extended` for the source-bound review of previously excluded detector classes; reports are preserved as CI artifacts. Use `npm --prefix hardhat run test:preflight`, `npm --prefix hardhat run test:deployment` and `npm --prefix hardhat run test:mainnet-fork` for deployment and real USDC local-fork qualification. All fork writes remain local. See [mainnet readiness](docs/MAINNET_READINESS.md) for the exact scope.
