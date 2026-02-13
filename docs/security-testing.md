# Security testing runbook

Use deterministic dependency installs:

```bash
npm ci
```

Security validation commands:

```bash
npm ci && npm test
forge test
slither . --config-file slither.config.json
```

Expected results:
- Truffle test suite passes and bytecode size guard passes.
- Foundry fuzz + invariants pass.
- Slither reports no unsuppressed High/Medium issues.

Echidna is optional for this repository; the Foundry invariant suite is the primary stateful property test.
