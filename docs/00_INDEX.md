# AGIJobManager Documentation Index

Audience tags: **Operator / Owner**, **Integrator**, **Developer**, **Auditor**.

## Core protocol docs
- [Architecture](./ARCHITECTURE.md) — system components, lifecycle, state model, trust boundaries. *(Operator / Integrator / Auditor)*
- [Protocol Flow](./PROTOCOL_FLOW.md) — escrow accounting, bonds, validator voting, disputes, event map. *(Operator / Auditor / Developer)*
- [Configuration](./CONFIGURATION.md) — owner-settable parameters, constraints, role matrix, identity lock behavior. *(Operator / Auditor)*
- [ENS Integration](./ENS_INTEGRATION.md) — ENSJobPages hooks, wrapped/unwrapped roots, fuse behavior, troubleshooting. *(Operator / Integrator / Auditor)*
- [Security Model](./SECURITY_MODEL.md) — repo-specific threat model, privilege assumptions, operational controls. *(Operator / Auditor)*
- [Troubleshooting](./TROUBLESHOOTING.md) — common failures, custom errors, operational runbook snippets. *(Operator / Integrator)*
- [Glossary](./GLOSSARY.md) — domain and contract terms used across this repository. *(All audiences)*

## Operations docs
- [Deploy Runbook](./DEPLOY_RUNBOOK.md) — pre-deploy checklist, exact migration/config scripts, smoke tests, lockdown steps. *(Operator / Owner)*
- [Testing Guide](./TESTING.md) — how CI and local test checks are executed. *(Developer / Auditor)*

## Source-of-truth implementation files
- `contracts/AGIJobManager.sol`
- `contracts/ens/ENSJobPages.sol`
- `contracts/utils/*.sol`
- `migrations/2_deploy_contracts.js`
- `migrations/deploy-config.js`
- `scripts/postdeploy-config.js`
- `scripts/verify-config.js`
- `package.json`
- `.github/workflows/ci.yml`
