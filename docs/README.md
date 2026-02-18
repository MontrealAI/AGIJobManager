# AGIJobManager Documentation Hub

Institutional documentation for operators, integrators, contributors, and auditors.

## Audience map

| Audience | Start here | Then read |
| --- | --- | --- |
| New contributor | [QUICKSTART.md](./QUICKSTART.md) | [TESTING.md](./TESTING.md), [REPO_MAP.md](./REPO_MAP.md) |
| Protocol operator | [OVERVIEW.md](./OVERVIEW.md) | [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md), [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md) |
| Security reviewer | [SECURITY_MODEL.md](./SECURITY_MODEL.md) | [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md), [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md) |
| Integrator | [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md) | [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md) |

## Core set

- [OVERVIEW.md](./OVERVIEW.md)
- [REPO_MAP.md](./REPO_MAP.md) *(generated)*
- [QUICKSTART.md](./QUICKSTART.md)
- [QUINTESSENTIAL_USE_CASE.md](./QUINTESSENTIAL_USE_CASE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [CONTRACTS/AGIJobManager.md](./CONTRACTS/AGIJobManager.md)
- [CONTRACTS/INTEGRATIONS.md](./CONTRACTS/INTEGRATIONS.md)
- [INTEGRATIONS/ENS.md](./INTEGRATIONS/ENS.md)
- [INTEGRATIONS/ENS_ROBUSTNESS.md](./INTEGRATIONS/ENS_ROBUSTNESS.md)
- [INTEGRATIONS/ENS_USE_CASE.md](./INTEGRATIONS/ENS_USE_CASE.md)
- [OPERATIONS/RUNBOOK.md](./OPERATIONS/RUNBOOK.md)
- [OPERATIONS/MONITORING.md](./OPERATIONS/MONITORING.md)
- [OPERATIONS/INCIDENT_RESPONSE.md](./OPERATIONS/INCIDENT_RESPONSE.md)
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [TESTING.md](./TESTING.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [GLOSSARY.md](./GLOSSARY.md)

## Generated references

- [REFERENCE/VERSIONS.md](./REFERENCE/VERSIONS.md)
- [REFERENCE/CONTRACT_INTERFACE.md](./REFERENCE/CONTRACT_INTERFACE.md)
- [REFERENCE/EVENTS_AND_ERRORS.md](./REFERENCE/EVENTS_AND_ERRORS.md)
- [REFERENCE/ENS_REFERENCE.md](./REFERENCE/ENS_REFERENCE.md)

## Design assets (text-only)

- [assets/palette.svg](./assets/palette.svg)
- [assets/architecture-wireframe.svg](./assets/architecture-wireframe.svg)

## Operational and CI assurances

- Deterministic generators: `npm run docs:gen` updates generated references.
- Freshness/integrity gate: `npm run docs:check` validates links, required sections, Mermaid, SVG, and generated drift.
- No-binaries enforcement: `npm run check:no-binaries` blocks new binary files in PRs.
- CI enforcement workflow: [`.github/workflows/docs.yml`](../.github/workflows/docs.yml).
