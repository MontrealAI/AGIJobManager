# Documentation index

This documentation set targets engineers, integrators, operators, and auditors. Each document has a focused scope with cross-references for faster navigation and auditability.

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

## Role guides
- **Employer**: [`roles/EMPLOYER.md`](roles/EMPLOYER.md)
- **Agent**: [`roles/AGENT.md`](roles/AGENT.md)
- **Validator**: [`roles/VALIDATOR.md`](roles/VALIDATOR.md)
- **Moderator**: [`roles/MODERATOR.md`](roles/MODERATOR.md)
- **Owner/Operator**: [`roles/OWNER_OPERATOR.md`](roles/OWNER_OPERATOR.md)
- **NFT Marketplace**: [`roles/NFT_MARKETPLACE.md`](roles/NFT_MARKETPLACE.md)

## Trust layer & integrations
- **ERC‑8004 integration (signaling → enforcement)**: [`ERC8004.md`](ERC8004.md)
- **Integrations overview**: [`Integrations.md`](Integrations.md)

## Operations and validation
- **Regression tests summary**: [`REGRESSION_TESTS.md`](REGRESSION_TESTS.md)
- **FAQ**: [`FAQ.md`](FAQ.md)

## Case studies
- **Legacy AGI Job #12 vs new contract**: [`case-studies/LEGACY_AGI_JOB_12_VS_NEW.md`](case-studies/LEGACY_AGI_JOB_12_VS_NEW.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
node scripts/generate-interface-doc.js
```
