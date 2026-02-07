# Documentation index

This documentation set targets engineers, integrators, operators, auditors, and non‑technical stakeholders. Each document has a focused scope with cross‑references for fast navigation and auditability.

## Core entry points (engineers & auditors)
- **Trust model & security overview**: [`trust-model-and-security-overview.md`](trust-model-and-security-overview.md)
- **Mainnet deployment & security overview (authoritative)**: [`mainnet-deployment-and-security-overview.md`](mainnet-deployment-and-security-overview.md)
- **Mainnet deployment & verification**: [`mainnet-deployment-and-verification.md`](mainnet-deployment-and-verification.md)
- **Architecture & state machine**: [`architecture.md`](architecture.md)
- **Deployments & bridging safety**: [`deployments-and-bridging.md`](deployments-and-bridging.md)
- **Contract specification**: [`AGIJobManager.md`](AGIJobManager.md)
- **Deployment guide (Truffle)**: [`Deployment.md`](Deployment.md)
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

## Newcomer & integrator quick reads
- **How AGI Jobs work (60‑second overview)**: [`how-agi-jobs-work.md`](how-agi-jobs-work.md)
- **ENS job pages (namespace + records)**: [`ens-job-pages.md`](ens-job-pages.md)
- **Job JSON schemas + examples**: [`job-json-schemas.md`](job-json-schemas.md)
- **Privacy & storage options**: [`privacy-and-storage.md`](privacy-and-storage.md)
- **Contract behavior summary**: [`contract-behavior.md`](contract-behavior.md)

## Operational references
- **Operator runbook**: [`operator-runbook.md`](operator-runbook.md)
- **Testing guide**: [`Testing.md`](Testing.md)
- **Test status (local run log)**: [`test-status.md`](test-status.md)
- **Known issues**: [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)
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
- **Validators (10‑minute workflow + incentives)**: [`validators.md`](validators.md)
- **Validator guide (15‑minute workflow)**: [`validator-guide.md`](validator-guide.md)
- **Moderator**: [`roles/MODERATOR.md`](roles/MODERATOR.md)
- **Owner/Operator**: [`roles/OWNER_OPERATOR.md`](roles/OWNER_OPERATOR.md)
- **NFT Marketplace**: [`roles/NFT_MARKETPLACE.md`](roles/NFT_MARKETPLACE.md)

## Namespace & extended references
- **AGI.Eth Namespace (alpha)**: [`namespace/AGI_ETH_NAMESPACE_ALPHA.md`](namespace/AGI_ETH_NAMESPACE_ALPHA.md)
- **ENS identity & namespaces**: [`ens-identity-and-namespaces.md`](ens-identity-and-namespaces.md)
- **Parameter safety & stuck‑funds checklist (ops)**: [`ops/parameter-safety.md`](ops/parameter-safety.md)
- **Case study**: [`case-studies/LEGACY_AGI_JOB_12_VS_NEW.md`](case-studies/LEGACY_AGI_JOB_12_VS_NEW.md)

## Regenerating interface docs

The interface reference is generated from the compiled ABI. After running a compile, regenerate it with:

```bash
npm run build
npm run docs:interface
```

## Known Issues / CI

### npm ci fails on Linux (fsevents)
- **Command**: `npm ci`
- **First failure**: `Unsupported platform for fsevents@2.3.2: wanted {"os":"darwin"} (current: {"os":"linux"})`
- **Likely cause**: `fsevents` is present in `package-lock.json` as a non‑optional dependency, so npm treats it as required on Linux.
- **Fix later**: regenerate `package-lock.json` with `fsevents` marked optional (or remove the dependency chain that pulls it in) so Linux installs succeed.

### npm test fails (missing Truffle)
- **Command**: `npm test`
- **First failure**: `sh: 1: truffle: not found`
- **Likely cause**: `npm ci` did not complete, so `node_modules/.bin` is missing.
- **Fix later**: resolve `npm ci` (see above), then re‑run `npm test`.

### npm run lint fails (missing solhint)
- **Command**: `npm run lint`
- **First failure**: `sh: 1: solhint: not found`
- **Likely cause**: `npm ci` did not complete, so `node_modules/.bin` is missing.
- **Fix later**: resolve `npm ci` (see above), then re‑run `npm run lint`.
