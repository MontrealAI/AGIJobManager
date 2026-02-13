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
