# Security Testing Runbook

Use deterministic installs before all checks:

```bash
npm ci
```

## Required checks

```bash
npm ci && npm test
~/.foundry/bin/forge test
slither . --config-file slither.config.json
```

## Expected outcomes

- Truffle unit/integration suite passes and bytecode size guard remains below EIP-170.
- Foundry fuzz + invariants pass without invariant violations.
- Slither reports no High/Medium issues on project contracts.

## Echidna

This repository relies on Foundry invariant tests as the primary property-testing layer.

## Slither configuration notes

`slither.config.json` suppresses a small set of noisy detectors for this repository:

- `reentrancy-*` and `reentrancy-balance`: core settlement/auth entrypoints are already guarded (`nonReentrant`) and covered by regression/invariant suites.
- `divide-before-multiply`: used in bounded bond/reward math with explicit caps and dedicated tests.
- `mapping-deletion`: expected for deleting job structs containing mappings after terminal settlement.
- `uninitialized-local`: false positives on Solidity default-initialized locals.
- `unused-return`: intentional best-effort ENS/namewrapper interactions where failures must not brick core flows.
