# Repository Map (Generated)

- Generated at (deterministic source fingerprint): `696cf8fbd3cc`.
- Source snapshot fingerprint: `696cf8fbd3cc`.

## Curated high-signal map

| Path | Purpose | Notes |
| --- | --- | --- |
| `contracts/AGIJobManager.sol` | Primary escrow/settlement contract with role gating and disputes | On-chain source of truth |
| `contracts/ens/` | ENS and NameWrapper integration interfaces/helpers | Best-effort identity checks |
| `contracts/utils/` | Math, transfer, URI, and ENS ownership helpers | Used by core contract |
| `hardhat/scripts/deploy.cjs` | Official public-network deployment and verification | Starts with intake paused; preserves transaction journals |
| `hardhat/scripts/check-readiness.cjs` | Read-only instance qualification before activation | No transactions; inspect report and owner acceptance |
| `migrations/1_deploy_contracts.js` | Retired Truffle fixture | Never use for public-network signing |
| `migrations/deploy-config.js` | Archived legacy fixture configuration | Use hardhat/deploy.config.example.cjs for public networks |
| `test/` | Hardhat-backed and node-based security/regression suites | Primary CI safety net |
| `forge-test/` | Foundry fuzz/invariant suites | Mandatory security qualification gate |
| `scripts/ops/validate-params.js` | Read-only on-chain parameter checker | Not a full production readiness check |
| `scripts/postdeploy-config.js` | Maintained local owner configuration routine | Public-chain writes are rejected; use verified owner controls for live instances |
| `scripts/check-no-binaries.mjs` | Repository policy guard against binary additions | Docs governance + supply chain hygiene |
| `ui/` | Next.js operator/demo frontend | Contains own docs and checks |
| `.github/workflows/ci.yml` | Main build/lint/test workflow | PR and main branch gate |
| `.github/workflows/docs.yml` | Docs and no-binaries policy workflow | Documentation freshness gate |
| `docs/` | Institutional documentation and generated references | Read docs/README.md first |

## Top-level directories

| Directory | Purpose signal |
| --- | --- |
| `config/` | Project-scoped directory discovered at repository root |
| `contracts/` | Project-scoped directory discovered at repository root |
| `docs/` | Project-scoped directory discovered at repository root |
| `examples/` | Project-scoped directory discovered at repository root |
| `forge-test/` | Project-scoped directory discovered at repository root |
| `hardhat/` | Project-scoped directory discovered at repository root |
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
- [`hardhat/README.md`](../hardhat/README.md)
- [`hardhat/scripts/deploy.cjs`](../hardhat/scripts/deploy.cjs)
- [`hardhat/scripts/check-readiness.cjs`](../hardhat/scripts/check-readiness.cjs)
- [`docs/START_HERE.md`](../docs/START_HERE.md)
- [`docs/DEPLOYMENT_OPERATIONS.md`](../docs/DEPLOYMENT_OPERATIONS.md)
- [`docs/SCRIPTS_REFERENCE.md`](../docs/SCRIPTS_REFERENCE.md)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [`.github/workflows/docs.yml`](../.github/workflows/docs.yml)

## Source files used

- repository root directory listing
- curated mapping declared in `scripts/docs/generate-repo-map.mjs`
