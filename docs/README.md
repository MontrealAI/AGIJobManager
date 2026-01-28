# Documentation index

Welcome to the AGIJobManager documentation set. Each document is scoped and cross-referenced so integrators, operators, auditors, and contributors can navigate quickly.

## Core documentation
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **ABI and interface reference (generated)**: [`Interface.md`](Interface.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
- **Security model and limitations**: [`Security.md`](Security.md)

## Integrations and ecosystem
- **Integrations overview**: [`Integrations.md`](Integrations.md)
- **ERC‑8004 off-chain adapter**: [`ERC8004.md`](ERC8004.md)

## Operations and validation
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
node scripts/generate-interface-doc.js
```
