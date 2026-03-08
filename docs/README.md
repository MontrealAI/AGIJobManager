# AGIJobManager Documentation Hub

Institutional documentation for operators, integrators, contributors, and auditors.

## Start here in one minute

If you only read one thing right now:
- **Deploy or operate on mainnet (recommended):** [../hardhat/README.md](../hardhat/README.md)
- **Replace ENSJobPages safely:** [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- **Owner using Etherscan only:** [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)

## Start here if you are...

- **A new operator deploying now:** start with [../hardhat/README.md](../hardhat/README.md), then [DEPLOYMENT/README.md](./DEPLOYMENT/README.md).
- **An ENSJobPages replacement operator:** use [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md) as the single canonical cutover flow.
- **A non-technical owner using Etherscan:** start with [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md), then [OWNER_RUNBOOK.md](./OWNER_RUNBOOK.md).
- **Troubleshooting ENS hook failures:** jump to [TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](./TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md).

## Audience map

| Audience | Start here | Then read |
| --- | --- | --- |
| New contributor | [QUICKSTART.md](./QUICKSTART.md) | [TESTING.md](./TESTING.md), [REPO_MAP.md](./REPO_MAP.md) |
| Protocol operator | [OVERVIEW.md](./OVERVIEW.md) | [DEPLOYMENT/README.md](./DEPLOYMENT/README.md), [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md), [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md) |
| Contract owner (non-technical) | [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) | [OWNER_RUNBOOK.md](./OWNER_RUNBOOK.md), [ETHERSCAN_GUIDE.md](./ETHERSCAN_GUIDE.md) |
| Security reviewer | [SECURITY_MODEL.md](./SECURITY_MODEL.md) | [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md), [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md) |
| Integrator | [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md) | [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md) |

## Most common operator tasks

- Deploy AGIJobManager (Hardhat, recommended): [../hardhat/README.md](../hardhat/README.md)
- Deploy/replace ENSJobPages (additive flow): [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- Verify deployment on Etherscan (and check post-cutover events): [ETHERSCAN_GUIDE.md](./ETHERSCAN_GUIDE.md)
- Migrate legacy ENS job pages: [DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md#8-legacy-migration-for-old-wrapped-job-pages](./DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md#8-legacy-migration-for-old-wrapped-job-pages)
- Perform mainnet owner cutover: [DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md)
- Troubleshoot ENS hook failures: [TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](./TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
- Understand ENS naming behavior: [ENS/ENS_JOB_PAGES_OVERVIEW.md](./ENS/ENS_JOB_PAGES_OVERVIEW.md)

## Core set

- [OVERVIEW.md](./OVERVIEW.md)
- [REPO_MAP.md](./REPO_MAP.md) *(generated)*
- [QUICKSTART.md](./QUICKSTART.md)
- [QUINTESSENTIAL_USE_CASE.md](./QUINTESSENTIAL_USE_CASE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT_OPERATIONS.md](./DEPLOYMENT_OPERATIONS.md)
- [Deployment Documentation Index (Hardhat recommended, Truffle legacy)](./DEPLOYMENT/README.md)
- [Ethereum Mainnet Beta Deployment Record](./DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)
- [Official Mainnet Deployment Record](./DEPLOYMENT/MAINNET_OFFICIAL_DEPLOYMENT_RECORD.md)
- [Owner Mainnet Deployment & Operations Guide](./DEPLOYMENT/OWNER_MAINNET_DEPLOYMENT_AND_OPERATIONS_GUIDE.md) (institutional, web-only owner operations)
- [Ethereum Mainnet Deployment, Verification & Ownership Transfer Guide (Truffle)](./DEPLOYMENT/MAINNET_TRUFFLE_DEPLOYMENT.md)
- [SCRIPTS_REFERENCE.md](./SCRIPTS_REFERENCE.md)
- [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md)
- [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md)
- [INTEGRATIONS/ENS.md](./INTEGRATIONS/ENS.md)
- [INTEGRATIONS/ENS_ROBUSTNESS.md](./INTEGRATIONS/ENS_ROBUSTNESS.md)
- [INTEGRATIONS/ENS_USE_CASE.md](./INTEGRATIONS/ENS_USE_CASE.md)
- [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md)
- [OPERATIONS/MONITORING.md](./OPERATIONS/MONITORING.md)
- [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md)
- [OPERATIONS/JOB_LIFECYCLE_ETHERSCAN_GUIDE.md](./OPERATIONS/JOB_LIFECYCLE_ETHERSCAN_GUIDE.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [TESTING.md](./TESTING.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [GLOSSARY.md](./GLOSSARY.md)
- [LEGAL/TERMS_AND_CONDITIONS.md](./LEGAL/TERMS_AND_CONDITIONS.md)
- [POLICY/AI_AGENTS_ONLY.md](./POLICY/AI_AGENTS_ONLY.md)

## Generated references

- [REFERENCE/VERSIONS.md](./REFERENCE/VERSIONS.md)
- [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md)
- [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md)
- [REFERENCE/ENS_REFERENCE.md](./REFERENCE/ENS_REFERENCE.md)
- [REFERENCE/OPERATIONAL_LIMITS.md](./REFERENCE/OPERATIONAL_LIMITS.md)
- [REFERENCE/URIS_JOBSPEC_AND_COMPLETION.md](./REFERENCE/URIS_JOBSPEC_AND_COMPLETION.md)

## Design assets (text-only)

- [assets/palette.svg](./assets/palette.svg)
- [assets/architecture-wireframe.svg](./assets/architecture-wireframe.svg)
