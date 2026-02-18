# Scripts and Automation Reference

This catalog documents operator and maintainer scripts across deployment, operations, security, docs, and UI maintenance.

## Script matrix

| Script / Command | Domain | Purpose | Typical user | Notes |
| --- | --- | --- | --- | --- |
| `npm run docs:gen` | Documentation | Regenerates deterministic docs under `docs/REFERENCE` and `docs/REPO_MAP.md` | Maintainer | Must run before committing source-driven doc changes |
| `npm run docs:check` | Documentation | Validates docs structure, freshness, links, Mermaid, required sections | Maintainer / CI | Fails if generated docs drift |
| `npm run check:no-binaries` | Policy | Blocks newly added binary assets or NUL-byte files | Maintainer / CI | Enforces text-only docs policy |
| `node scripts/postdeploy-config.js --network <n> --address <a>` | Operations | Applies post-deploy owner configuration | Owner/operator | Requires explicit reviewed env/config inputs |
| `truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJobManager>` | Operations | Checks live on-chain parameter bounds and safety assumptions | Owner/operator | Must be run via `truffle exec`; script requires `--address` |
| `node scripts/etherscan/prepare_inputs.js --action ...` | Operator UX | Generates Etherscan-safe input payloads | Owner/operator | Reduces manual ABI argument mistakes |
| `node scripts/merkle/export_merkle_proofs.js --input ... --output ...` | Eligibility | Generates Merkle roots/proofs for allowlists | Ops + integrator | Keep source list auditable |
| `npm run ui:abi` | UI | Exports contract ABI consumed by UI | UI maintainer | Pair with `npm run ui:abi:check` in PRs |
| `npm run slither` | Security | Runs static-analysis lane via local wrapper | Security reviewer | Optional hardening lane |

## CI contract for documentation governance

- `.github/workflows/docs.yml` enforces:
  - `npm ci`
  - `node scripts/check-no-binaries.mjs`
  - `npm run docs:check`
- Merge policy expectation: docs and generators must remain in lockstep.

## Script authoring standards

When adding new scripts:

1. Prefer Node built-in modules for portability.
2. Keep output deterministic and stable where script output is committed.
3. Emit operationally useful failure messages with remediation guidance.
4. Avoid hidden network dependencies for docs/security checks.
5. Document new scripts in this file and in `package.json` scripts where applicable.

## Security posture for script execution

- Never hardcode secrets, private keys, or RPC credentials in scripts.
- Route configurable values through environment variables and reviewed config files.
- Use dry-run modes (`--dry-run`) whenever available before live execution.
- Preserve tx hashes/logs for audit trail in operational changes.
