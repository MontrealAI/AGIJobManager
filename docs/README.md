# Documentation index

This documentation set targets engineers, integrators, operators, and auditors. Each document has a focused scope with cross-references for faster navigation and auditability.

## Core documentation
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **ABI and interface reference (generated)**: [`Interface.md`](Interface.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
- **Security model and limitations**: [`Security.md`](Security.md)

## Trust layer & integrations
- **ERC‑8004 integration (signaling → enforcement)**: [`ERC8004.md`](ERC8004.md)
- **Integrations overview**: [`Integrations.md`](Integrations.md)

## Operations and validation
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
node scripts/generate-interface-doc.js
```
