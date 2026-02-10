# AGIJobManager Documentation Index

This index is grounded in the repository at current `HEAD` and is intended for three primary audiences:
- **Operators / Owners** (business administrators running deployments)
- **Integrators / Developers** (applications and service integration)
- **Auditors / Reviewers** (security and process verification)

## Core navigation

| Document | Audience | Purpose |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Operator, Developer, Auditor | Contract/component architecture, lifecycle diagrams, trust boundaries. |
| [PROTOCOL_FLOW.md](./PROTOCOL_FLOW.md) | Operator, Auditor | Escrow accounting, bond economics, settlement/dispute mechanics, event map. |
| [CONFIGURATION.md](./CONFIGURATION.md) | Operator, Auditor | Full owner-configurable parameter reference and permissions matrix. |
| [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md) | Operator | Deploy-day checklist and post-deploy operational procedure. |
| [ENS_INTEGRATION.md](./ENS_INTEGRATION.md) | Integrator, Operator, Auditor | ENS hooks, wrapped/unwrapped root behavior, troubleshooting. |
| [SECURITY_MODEL.md](./SECURITY_MODEL.md) | Operator, Auditor | Threat model, failure modes, role-compromise impact, monitoring guidance. |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Operator, Integrator | Common failures, custom-error table, incident runbook snippets. |
| [GLOSSARY.md](./GLOSSARY.md) | All | Canonical terms used in this repository. |

## Canonical source-of-truth files

Operational and protocol behavior should always be validated against:
- `contracts/AGIJobManager.sol`
- `contracts/ens/ENSJobPages.sol`
- `migrations/deploy-config.js`
- `migrations/2_deploy_contracts.js`
- `scripts/postdeploy-config.js`
- `package.json`
- `truffle-config.js`
- `.github/workflows/ci.yml`
