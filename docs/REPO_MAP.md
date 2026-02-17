# Repository Map (Generated)

- Generated at (deterministic source fingerprint): `b16a32b567f3`.
- Source snapshot fingerprint: `b16a32b567f3`.

## Curated high-signal map

| Path | Purpose | Notes |
| --- | --- | --- |
| `contracts/AGIJobManager.sol` | Primary escrow/settlement contract with role gating and disputes | On-chain source of truth |
| `contracts/ens/` | ENS and NameWrapper integration interfaces/helpers | Best-effort identity checks |
| `contracts/utils/` | Math, transfer, URI, and ENS ownership helpers | Used by core contract |
| `migrations/1_deploy_contracts.js` | Truffle deployment entrypoint | Reads deployment config |
| `migrations/deploy-config.js` | Network-dependent deployment parameters | Operator-reviewed before deploy |
| `test/` | Truffle and node-based security/regression suites | Primary CI safety net |
| `forge-test/` | Foundry fuzz/invariant suites | Optional hardening lane |
| `scripts/ops/validate-params.js` | Parameter sanity checker for operations | Run before live changes |
| `scripts/postdeploy-config.js` | Post-deploy owner configuration routine | Operational setup automation |
| `ui/` | Next.js operator/demo frontend | Contains own docs and checks |
| `.github/workflows/ci.yml` | Main build/lint/test workflow | PR and main branch gate |
| `.github/workflows/docs.yml` | Docs and no-binaries policy workflow | Documentation freshness gate |
| `docs/` | Institutional documentation and generated references | Read docs/README.md first |

## Top-level directories

| Directory | Purpose signal |
| --- | --- |
| `contracts/` | Project-scoped directory discovered at repository root |
| `docs/` | Project-scoped directory discovered at repository root |
| `forge-test/` | Project-scoped directory discovered at repository root |
| `integrations/` | Project-scoped directory discovered at repository root |
| `lib/` | Project-scoped directory discovered at repository root |
| `migrations/` | Project-scoped directory discovered at repository root |
| `presentations/` | Project-scoped directory discovered at repository root |
| `scripts/` | Project-scoped directory discovered at repository root |
| `test/` | Project-scoped directory discovered at repository root |
| `ui/` | Project-scoped directory discovered at repository root |
| `ui-tests/` | Project-scoped directory discovered at repository root |

## Key entrypoints

- [`README.md`](../README.md)
- [`docs/README.md`](../docs/README.md)
- [`contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`test/AGIJobManager.test.js`](../test/AGIJobManager.test.js)
- [`migrations/1_deploy_contracts.js`](../migrations/1_deploy_contracts.js)
- [`scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [`.github/workflows/docs.yml`](../.github/workflows/docs.yml)

## Source files used

- repository root directory listing
- curated mapping declared in `scripts/docs/generate-repo-map.mjs`
