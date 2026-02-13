# Testing

## Test matrix

| Suite | Purpose | Command | Validates |
| --- | --- | --- | --- |
| Truffle + JS integration | Lifecycle and escrow behavior | `npm run test` | Core correctness and regression coverage |
| Bytecode checks | Deployment feasibility | `npm run size` | EIP-170 runtime size policy |
| UI smoke | ABI/UI contract alignment | `npm run test:ui` | Frontend basic flows |
| Docs checks | Documentation freshness and policy | `npm run docs:check` | required files/diagrams/links/generation freshness |

## Optional hardening tools

If desired, teams may run additional tools (e.g., Slither, Echidna, Foundry invariants) externally; this repo does not force heavy security-tool dependencies in default CI.
