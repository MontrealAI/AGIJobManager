# Documentation index

This documentation set targets engineers, integrators, operators, and auditors. Each document has a focused scope with cross‑references for fast navigation and auditability.

## Core entry points
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
- **Security model and limitations**: [`Security.md`](Security.md)
- **Full‑stack trust layer (ERC‑8004 → enforcement)**: [`ERC8004.md`](ERC8004.md)
- **ABI and interface reference (generated)**: [`Interface.md`](Interface.md)

## Operator and governance references
- **Operator guide**: [`AGIJobManager_Operator_Guide.md`](AGIJobManager_Operator_Guide.md)
- **Minimal governance model**: [`GOVERNANCE.md`](GOVERNANCE.md)
- **Configure‑once deployment profile**: [`DEPLOYMENT_PROFILE.md`](DEPLOYMENT_PROFILE.md)
- **Deployment checklist**: [`deployment-checklist.md`](deployment-checklist.md)

## User guide (non‑technical)
- **Landing page**: [`user-guide/README.md`](user-guide/README.md)
- **Roles**: [`user-guide/roles.md`](user-guide/roles.md)
- **Happy path walkthrough**: [`user-guide/happy-path.md`](user-guide/happy-path.md)
- **Common revert reasons**: [`user-guide/common-reverts.md`](user-guide/common-reverts.md)
- **Merkle proofs**: [`user-guide/merkle-proofs.md`](user-guide/merkle-proofs.md)
- **Glossary**: [`user-guide/glossary.md`](user-guide/glossary.md)

## Trust layer & integrations
- **ERC‑8004 integration (control plane ↔ execution plane)**: [`erc8004/README.md`](erc8004/README.md)
- **Integrations overview**: [`Integrations.md`](Integrations.md)

## Testing & troubleshooting
- **Testing guide**: [`Testing.md`](Testing.md)
- **Troubleshooting**: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
npm run docs:interface
```
