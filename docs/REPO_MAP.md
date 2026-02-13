# Repository Map (Generated)

- Verified against repository state: `943ca89`.

## Curated high-signal map

| Path | Purpose | Notes |
| --- | --- | --- |
| `contracts/AGIJobManager.sol` | Primary escrow/settlement contract with role gating and disputes | On-chain source of truth |
| `contracts/ens/` | ENS and NameWrapper integration interfaces/helpers | Best-effort identity checks |
| `contracts/utils/` | Math, transfer, URI, and ENS ownership helpers | Used by core contract |
| `migrations/2_deploy_contracts.js` | Truffle deployment entrypoint | Reads deployment config |
| `migrations/deploy-config.js` | Network-dependent deployment parameters | Operator-reviewed before deploy |
| `test/` | Truffle and node-based security/regression suites | Primary CI safety net |
| `forge-test/` | Foundry fuzz/invariant suites | Optional hardening lane |
| `scripts/ops/validate-params.js` | Parameter sanity checker for operations | Run before live changes |
| `scripts/postdeploy-config.js` | Post-deploy owner configuration routine | Operational setup automation |
| `ui/` | Next.js operator/demo frontend | Contains own docs and checks |
| `.github/workflows/ci.yml` | Main build/lint/test workflow | PR and main branch gate |
| `.github/workflows/docs.yml` | Docs and no-binaries policy workflow | Documentation freshness gate |
| `docs/` | Institutional documentation and generated references | Read docs/README.md first |

## Top-level inventory

| Entry | Kind |
| --- | --- |
| `.env.example` | file |
| `.solhint.json` | file |
| `CODE_OF_CONDUCT.md` | file |
| `contracts` | dir |
| `CONTRIBUTING.md` | file |
| `docs` | dir |
| `forge-test` | dir |
| `foundry.toml` | file |
| `integrations` | dir |
| `lib` | dir |
| `LICENSE` | file |
| `MAINNET_DEPLOYMENT_CHECKLIST.md` | file |
| `migrations` | dir |
| `node_modules` | dir |
| `package-lock.json` | file |
| `package.json` | file |
| `presentations` | dir |
| `README.md` | file |
| `scripts` | dir |
| `SECURITY_TESTING.md` | file |
| `SECURITY.md` | file |
| `slither.config.json` | file |
| `test` | dir |
| `truffle-config.js` | file |
| `ui` | dir |
| `ui-tests` | dir |
