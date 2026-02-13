# Testing

## Current strategy

- Truffle/JS suites under [`test/`](../test) cover lifecycle, accounting, disputes, role gates, ENS hooks, and regressions.
- Foundry suites under [`forge-test/`](../forge-test) provide fuzz/invariant hardening.
- UI smoke checks validate ABI sync and front-end critical path.

## Test matrix

| Suite | Purpose | Command | Validates |
| --- | --- | --- | --- |
| Contract CI lane | Full compile + truffle tests + bytecode guard | `npm test` | Core protocol correctness |
| Lint lane | Solidity lint rules | `npm run lint` | Style/safety linting |
| Bytecode lane | EIP-170 guardrail | `npm run size` | Deployability constraints |
| UI smoke lane | Contract/UI integration sanity | `npm run test:ui` | ABI + flow coherence |
| Optional foundry lane | Fuzz/invariant stress | `forge test` | Property-based resilience |

## Optional hardening tooling

- Slither config exists in [`slither.config.json`](../slither.config.json). Run if locally installed.
- Foundry config exists in [`foundry.toml`](../foundry.toml).
