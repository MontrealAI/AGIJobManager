# Repository Map (Generated)

Verified against repository state: `79d6495`.

Generated at: `2026-02-13T14:45:51-05:00`.

## Curated map

| Folder/File | Purpose | Key entrypoint | Notes |
| --- | --- | --- | --- |
| `contracts/` | Solidity contracts and interfaces | `contracts/AGIJobManager.sol` | Primary escrow and settlement contract |
| `contracts/ens/` | ENS and NameWrapper interfaces + ENSJobPages helper | `contracts/ens/ENSJobPages.sol` | Best-effort metadata/hook integration |
| `contracts/test/` | Mock contracts for adversarial and integration tests | `contracts/test/MockENSJobPages.sol` | Test-only fixtures |
| `test/` | Truffle/JS test suites | `test/jobLifecycle.core.test.js` | Lifecycle, invariants, and hardening coverage |
| `migrations/` | Truffle deployment scripts | `migrations/2_deploy_contracts.js` | Network-aware deploy entrypoint |
| `scripts/ops/` | Operational parameter validation scripts | `scripts/ops/validate-params.js` | Safety checks for deploy-time config |
| `scripts/merkle/` | Merkle tree proof generation and smoke tests | `scripts/merkle/generate_merkle_proof.js` | Allowlist operations |
| `scripts/ui/` | UI smoke and ABI sync tooling | `scripts/ui/run_ui_smoke_test.js` | Frontend contract compatibility |
| `scripts/docs/` | Deterministic docs generators and checks | `scripts/docs/check-docs.mjs` | Freshness and structural enforcement |
| `docs/` | Repository documentation source | `docs/README.md` | Institutional docs and references |
| `.github/workflows/` | CI workflows | `.github/workflows/ci.yml` | Build, tests, docs, and policy checks |
| `ui/` | Web user interface project | `ui/package.json` | Separate build and tests |
| `truffle-config.js` | Compiler and network configuration | `truffle-config.js` | Pinned solc + network wiring |
| `package.json` | Node scripts and dependencies | `package.json` | Canonical script entrypoints |

## Top-level entries

- `.github`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `MAINNET_DEPLOYMENT_CHECKLIST.md`
- `README.md`
- `SECURITY.md`
- `SECURITY_TESTING.md`
- `build`
- `contracts`
- `docs`
- `forge-test`
- `foundry.toml`
- `integrations`
- `lib`
- `migrations`
- `node_modules`
- `package-lock.json`
- `package.json`
- `presentations`
- `scripts`
- `slither.config.json`
- `test`
- `truffle-config.js`
- `ui`
- `ui-tests`
