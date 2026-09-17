# Scripts and Automation Reference

> v0.9.2: Operator scripts use ethers 6 and the compiled Hardhat artifacts. The post-deploy configuration script only writes to disposable local chains. Use [Hardhat](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.2/hardhat/README.md) for public deployments and the [owner console](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.2/docs/OWNER_CONTROLS.md) for live configuration.

This catalog documents operator and maintainer scripts across deployment, operations, security, docs, and UI maintenance.

## Script matrix

| Script / Command | Domain | Purpose | Typical user | Notes |
| --- | --- | --- | --- | --- |
| `npm run docs:gen` | Documentation | Regenerates deterministic docs under `docs/REFERENCE` and `docs/REPO_MAP.md` | Maintainer | Must run before committing source-driven doc changes |
| `npm run docs:check` | Documentation | Validates docs structure, freshness, links, Mermaid, required sections | Maintainer / CI | Fails if generated docs drift |
| `npm run check:no-binaries` | Policy | Blocks newly added binary assets or NUL-byte files | Maintainer / CI | Enforces text-only docs policy |
| `node scripts/postdeploy-config.js --network development --address <a> --config-path <file> --dry-run` | Local operations | Plans local owner configuration; omit `--dry-run` to apply | Developer | Enforces chain ID 1337/31337, uses `TX_FROM` or the first local unlocked account, and waits for each receipt |
| `node scripts/verify-config.js --network <n> --address <a> --config-path <file>` | Operations | Compares configured expectations with on-chain values | Owner/operator | Read-only; exits nonzero on mismatches |
| `node scripts/ops/validate-params.js --network <n> --address <a> --from-block <block>` | Operations | Checks on-chain parameter bounds | Owner/operator | Read-only; configuration notices remain visible; not a full production readiness review |
| `node scripts/ops/encode_constructor_args.js --receipt <file>` | Verification | Encodes the constructor arguments from a deployment receipt | Owner/operator | Offline; includes both fixed settlement wallet addresses |
| `node scripts/erc8004/export_metrics.js --network <n> --address <a> --from-block <block> --out-dir <dir>` | Integration | Exports deterministic event-based metrics | Integrator | Read-only; explicit manager address required |
| `node scripts/erc8004/export_feedback.js --network <n> --address <a> --out-dir <dir>` | Integration | Exports feedback files and wallet mapping results | Integrator | Read-only; see [ERC-8004 inputs](../integrations/erc8004/README.md) for registry and agent ID settings |
| `node scripts/erc8004/generate_submit_actions.js --feedback-dir <dir> --out-dir <dir> --reputation-registry <a>` | Integration | Prepares feedback calldata | Integrator | Offline dry run by default; actual sending requires explicit environment switches and sender eligibility checks |
| `node scripts/nft/generate-job-nft-metadata.mjs --rpc <url> --manager <a> --jobs 1,2 --out <dir>` | NFT metadata | Exports job completion metadata | Integrator | Read-only |
| `node scripts/etherscan/prepare_inputs.js --action ...` | Operator UX | Generates Etherscan-safe input payloads | Owner/operator | Reduces manual ABI argument mistakes |
| `node scripts/merkle/export_merkle_proofs.js --input ... --output ...` | Eligibility | Generates Merkle roots/proofs for allowlists | Ops + integrator | Keep source list auditable |
| `npm run ui:abi` | UI | Exports contract ABI consumed by UI | UI maintainer | Pair with `npm run ui:abi:check` in PRs |
| `npm run slither` | Security | Runs static-analysis lane via local wrapper | Security reviewer | Optional hardening lane |


## Migrating operator commands from v0.9.0

Run `npm ci`, `npm --prefix hardhat ci`, and `npm run build` before scripts that load the manager ABI. Replace `truffle exec scripts/...` with `node scripts/...`; Truffle and Ganache are no longer installed. Direct Node execution now runs the configuration and export commands instead of merely exporting an unused callback.

Read-only scripts select `--network development` by default, with `http://127.0.0.1:8545` as the local RPC. Use `--network mainnet` with `MAINNET_RPC_URL`, or `--network sepolia` with `SEPOLIA_RPC_URL`. `RPC_URL` and the existing `WEB3_PROVIDER` alias can supply an explicit endpoint; the selected public network must match its actual chain ID. These commands do not load a private key or send transactions.

`postdeploy-config.js` remains a local rehearsal tool. Public-chain writes fail before an account is requested, including when the command was incorrectly labelled `development`. Use the reviewed [owner controls](OWNER_CONTROLS.md) for live configuration. Its dry run does not request a signing account. Actual local writes wait for successful mining before verifying the updated state; ownership transfer remains a two-step proposal.

The retired `migrations/1_deploy_contracts.js` fails with a migration guide pointer. Public deployments use [Hardhat](../hardhat/README.md); `npm run test:ui` constructs a disposable local UI fixture using the maintained runtime.

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
