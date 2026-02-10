# AGIJobManager Documentation Index

## Purpose
Single navigation entrypoint for engineers, auditors, and operators working with this repository.

## Audience
- Smart contract engineers
- Security reviewers / auditors
- Deployment operators
- Integrators building against on-chain APIs

## Preconditions
- Read repository governance and safety docs first: [`../CONTRIBUTING.md`](../CONTRIBUTING.md), [`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md), [`../SECURITY.md`](../SECURITY.md).

## Start Here
1. **Architecture and trust model**: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
2. **Developer setup**: [`QUICKSTART.md`](./QUICKSTART.md)
3. **Contract map**: [`CONTRACTS_OVERVIEW.md`](./CONTRACTS_OVERVIEW.md)
4. **Core contract reference**: [`contracts/AGIJobManager.md`](./contracts/AGIJobManager.md)

## Full Navigation

### Core
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`CONTRACTS_OVERVIEW.md`](./CONTRACTS_OVERVIEW.md)
- [`SECURITY_MODEL.md`](./SECURITY_MODEL.md)
- [`GLOSSARY.md`](./GLOSSARY.md)

### Developer
- [`QUICKSTART.md`](./QUICKSTART.md)
- [`TESTING.md`](./TESTING.md)

### Contract Reference
- [`contracts/AGIJobManager.md`](./contracts/AGIJobManager.md)
- [`contracts/ENSJobPages.md`](./contracts/ENSJobPages.md)
- [`contracts/Utilities.md`](./contracts/Utilities.md)
- [`contracts/Interfaces.md`](./contracts/Interfaces.md)

### Operations
- [`CONFIGURATION_REFERENCE.md`](./CONFIGURATION_REFERENCE.md)
- [`DEPLOY_DAY_RUNBOOK.md`](./DEPLOY_DAY_RUNBOOK.md)
- [`OPERATIONS_RUNBOOK.md`](./OPERATIONS_RUNBOOK.md)

## Gotchas / Failure Modes
- This repo contains legacy and overlapping docs. Treat the pages linked above as the canonical maintainer set for current operations.
- ENS pages are metadata-plane integrations; escrow settlement does not depend on ENS hook success.

## Code References
- Main contract: [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- ENS pages: [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
- Deployment scripts: [`../migrations/2_deploy_contracts.js`](../migrations/2_deploy_contracts.js), [`../scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
