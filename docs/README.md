# AGIJobManager Documentation Hub

## Audience map

| Audience | Start here | Why |
| --- | --- | --- |
| Operator | [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md), [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Deployment, role operation, and incident handling |
| Developer | [TESTING.md](./TESTING.md), [TEST_PLAN.md](./TEST_PLAN.md), [ARCHITECTURE.md](./ARCHITECTURE.md) | Local workflows and deterministic test expansion |
| Auditor | [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md), [CONFIGURATION.md](./CONFIGURATION.md) | Trust boundaries, controls, and parameter review |

## Primary index

- [00_INDEX.md](./00_INDEX.md)

## Core references

- [Architecture](./ARCHITECTURE.md)
- [Protocol Flow](./PROTOCOL_FLOW.md)
- [Configuration](./CONFIGURATION.md)
- [Deploy Runbook](./DEPLOY_RUNBOOK.md)
- [ENS Integration](./ENS_INTEGRATION.md)
- [Security Model](./SECURITY_MODEL.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Glossary](./GLOSSARY.md)

## Implementation sources of truth

- `contracts/AGIJobManager.sol`
- `contracts/ens/ENSJobPages.sol`
- `migrations/2_deploy_contracts.js`
- `migrations/deploy-config.js`
- `scripts/postdeploy-config.js`
- `scripts/verify-config.js`
- `package.json`
- `.github/workflows/ci.yml`
