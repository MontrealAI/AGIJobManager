# Documentation index

This documentation set targets engineers, integrators, operators, and auditors **and** now includes non‑technical user guides. Each document has a focused scope with cross-references for faster navigation and auditability.

## Start here (non‑technical user guides)
- **Roles overview**: [`guides/ROLES.md`](guides/ROLES.md)
- **Happy path walkthrough**: [`guides/HAPPY_PATH.md`](guides/HAPPY_PATH.md)
- **Troubleshooting (“execution reverted”)**: [`guides/TROUBLESHOOTING.md`](guides/TROUBLESHOOTING.md)
- **Identity & proofs explained**: [`guides/IDENTITY_AND_PROOFS.md`](guides/IDENTITY_AND_PROOFS.md)
- **Glossary**: [`GLOSSARY.md`](GLOSSARY.md)

## Core documentation
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **ABI and interface reference (generated)**: [`Interface.md`](Interface.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
- **Security model and limitations**: [`Security.md`](Security.md)
- **User start‑here guide**: [`USERS.md`](USERS.md)
- **Function reference**: [`REFERENCE.md`](REFERENCE.md)
- **Testing guide**: [`TESTING.md`](TESTING.md)
- **Troubleshooting**: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- **Security best practices**: [`SECURITY_BEST_PRACTICES.md`](SECURITY_BEST_PRACTICES.md)
- **AGI.Eth Namespace (alpha)**: [`namespace/AGI_ETH_NAMESPACE_ALPHA.md`](namespace/AGI_ETH_NAMESPACE_ALPHA.md)

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

## Operations and validation
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Case studies
- **Legacy AGI Job #12 vs new contract**: [`case-studies/LEGACY_AGI_JOB_12_VS_NEW.md`](case-studies/LEGACY_AGI_JOB_12_VS_NEW.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
npm run docs:interface
```
