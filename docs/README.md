# Documentation index

This documentation set targets engineers, integrators, operators, auditors, and non‑technical stakeholders. Each document has a focused scope with cross‑references for fast navigation and auditability.

## Core entry points (engineers & auditors)
- **AGI Jobs one‑pager (canonical)**: [`AGI_JOBS_ONE_PAGER.md`](AGI_JOBS_ONE_PAGER.md)
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
- **Governance model**: [`GOVERNANCE.md`](GOVERNANCE.md)
- **Security model and limitations**: [`Security.md`](Security.md)
- **Parameter safety & stuck‑funds analysis**: [`ParameterSafety.md`](ParameterSafety.md)
- **Full‑stack trust layer (ERC‑8004 → enforcement)**: [`ERC8004.md`](ERC8004.md)
- **ABI and interface reference (generated)**: [`Interface.md`](Interface.md)

## User guide (non‑technical)
- **Landing page**: [`user-guide/README.md`](user-guide/README.md)
- **Roles**: [`user-guide/roles.md`](user-guide/roles.md)
- **Happy path walkthrough**: [`user-guide/happy-path.md`](user-guide/happy-path.md)
- **Common revert reasons**: [`user-guide/common-reverts.md`](user-guide/common-reverts.md)
- **Merkle proofs**: [`user-guide/merkle-proofs.md`](user-guide/merkle-proofs.md)
- **Glossary**: [`user-guide/glossary.md`](user-guide/glossary.md)

## Operational references
- **Testing guide**: [`Testing.md`](Testing.md)
- **Troubleshooting**: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Trust layer & integrations
- **Full‑stack trust layer (ERC‑8004 → enforcement)**: [`ERC8004.md`](ERC8004.md)
- **ERC‑8004 integration (control plane ↔ execution plane)**: [`erc8004/README.md`](erc8004/README.md)
- **Integrations overview**: [`Integrations.md`](Integrations.md)

## Role guides
- **Employer**: [`roles/EMPLOYER.md`](roles/EMPLOYER.md)
- **Agent**: [`roles/AGENT.md`](roles/AGENT.md)
- **Validator**: [`roles/VALIDATOR.md`](roles/VALIDATOR.md)
- **Moderator**: [`roles/MODERATOR.md`](roles/MODERATOR.md)
- **Owner/Operator**: [`roles/OWNER_OPERATOR.md`](roles/OWNER_OPERATOR.md)
- **NFT Marketplace**: [`roles/NFT_MARKETPLACE.md`](roles/NFT_MARKETPLACE.md)

## Namespace & extended references
- **AGI.Eth Namespace (alpha)**: [`namespace/AGI_ETH_NAMESPACE_ALPHA.md`](namespace/AGI_ETH_NAMESPACE_ALPHA.md)
- **Parameter safety & stuck‑funds checklist (ops)**: [`ops/parameter-safety.md`](ops/parameter-safety.md)
- **Case study**: [`case-studies/LEGACY_AGI_JOB_12_VS_NEW.md`](case-studies/LEGACY_AGI_JOB_12_VS_NEW.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
npm run docs:interface
```
