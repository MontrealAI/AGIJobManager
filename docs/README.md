# AGIJobManager Documentation Index

## Purpose
Provide a single navigation entry for engineers, auditors, and operators working with this repository.

## Audience
- Smart-contract developers
- Security reviewers/auditors
- Deployment and incident-response operators
- Integrators calling contract methods directly

## Preconditions / assumptions
- You are working from repository root.
- You have read the root governance/security docs: [`../CONTRIBUTING.md`](../CONTRIBUTING.md), [`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md), [`../SECURITY.md`](../SECURITY.md).

## Start here
1. [Quickstart](./QUICKSTART.md)
2. [Architecture](./ARCHITECTURE.md)
3. [Contracts overview](./CONTRACTS_OVERVIEW.md)
4. [Configuration reference](./CONFIGURATION_REFERENCE.md)
5. [Deploy Day runbook](./DEPLOY_DAY_RUNBOOK.md)
6. [Operations runbook](./OPERATIONS_RUNBOOK.md)

## Contract reference
- [AGIJobManager](./contracts/AGIJobManager.md)
- [ENSJobPages](./contracts/ENSJobPages.md)
- [Utilities (BondMath/ReputationMath/TransferUtils/UriUtils/ENSOwnership)](./contracts/Utilities.md)
- [Interfaces (ENS Registry/NameWrapper/PublicResolver)](./contracts/Interfaces.md)

## Security / quality
- [Security model and invariants](./SECURITY_MODEL.md)
- [Testing guide](./TESTING.md)
- [Glossary](./GLOSSARY.md)

## Gotchas / failure modes
- `docs/architecture.md` (lowercase) and `docs/ARCHITECTURE.md` both exist historically; prefer this index link to `ARCHITECTURE.md`.
- Keep commands aligned with `package.json`; do not invent non-existent npm scripts.

## References
- [`../package.json`](../package.json)
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
