# Deployment guide (Truffle)

This guide documents the deployment and verification workflow defined in `truffle-config.js` and the migration scripts in `migrations/`.

## Prerequisites
- Node.js and npm (CI uses Node 20).
- Truffle (installed via `npm install`).
- RPC access for Sepolia or Mainnet (or a local Ganache instance).

## Environment variables

The configuration supports both direct RPC URLs and provider keys. `PRIVATE_KEYS` is required for Sepolia/Mainnet deployments.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PRIVATE_KEYS` | Deployer keys | Comma-separated, no spaces. Required for Sepolia/Mainnet deployments. |
| `SEPOLIA_RPC_URL` | Sepolia RPC URL | Optional if using Alchemy or Infura. |
| `MAINNET_RPC_URL` | Mainnet RPC URL | Optional if using Alchemy or Infura. |
| `ALCHEMY_KEY` | Alchemy key for Sepolia | Used if `SEPOLIA_RPC_URL` is empty. |
| `ALCHEMY_KEY_MAIN` | Alchemy key for Mainnet | Falls back to `ALCHEMY_KEY` if empty. |
| `INFURA_KEY` | Infura key | Used if no direct RPC URL or Alchemy key. |
| `ETHERSCAN_API_KEY` | Verification key | Used by `truffle-plugin-verify`. |
| `SEPOLIA_GAS` / `MAINNET_GAS` | Gas limit override | Defaults to 8,000,000. |
| `SEPOLIA_GAS_PRICE_GWEI` / `MAINNET_GAS_PRICE_GWEI` | Gas price override | In Gwei. |
| `SEPOLIA_CONFIRMATIONS` / `MAINNET_CONFIRMATIONS` | Confirmations to wait | Defaults to 2. |
| `SEPOLIA_TIMEOUT_BLOCKS` / `MAINNET_TIMEOUT_BLOCKS` | Timeout blocks | Defaults to 500. |
| `RPC_POLLING_INTERVAL_MS` | Provider polling interval | Defaults to 8000 ms. |
| `SOLC_VERSION` / `SOLC_RUNS` / `SOLC_VIA_IR` / `SOLC_EVM_VERSION` | Compiler settings | Default `SOLC_VERSION` is 0.8.33; keep these consistent for verification. |
| `GANACHE_MNEMONIC` | Local test mnemonic | Defaults to Ganache standard mnemonic if unset. |

A template lives in [`.env.example`](../.env.example).

## Networks configured
- **test**: in-process Ganache provider for `truffle test`.
- **development**: local RPC at `127.0.0.1:8545` (Ganache).
- **sepolia**: remote deployment via RPC (HDWalletProvider).
- **mainnet**: remote deployment via RPC (HDWalletProvider).

The default `npm test` script compiles with `--all`, runs `truffle test --network test`, and then executes an additional JavaScript test harness. Use the `test` network for deterministic local runs.

## Migration script notes

The deployment script in `migrations/2_deploy_contracts.js` hardcodes constructor parameters (token address, ENS registry, NameWrapper address, root nodes, Merkle roots). **Edit these values** before deploying to any production network.

## Local deployment (Ganache)

1. Start Ganache:
   ```bash
   npx ganache -p 8545
   ```
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network development
   ```

## Sepolia deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network sepolia
   ```

## Mainnet deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network mainnet
   ```

## Verification (Etherscan)

When `ETHERSCAN_API_KEY` is set:

```bash
npx truffle run verify AGIJobManager --network sepolia
```

```bash
npx truffle run verify AGIJobManager --network mainnet
```

### Verification tips
- Keep the compiler settings (`SOLC_VERSION`, `SOLC_RUNS`, `SOLC_VIA_IR`, `SOLC_EVM_VERSION`) identical to the original deployment.
- Ensure your migration constructor parameters match the deployed contract.
- If the Etherscan plugin fails, re-run with `--debug` to capture full output.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Missing RPC URL for sepolia` or `mainnet` | No direct RPC URL or provider key found. | Set `SEPOLIA_RPC_URL` / `MAINNET_RPC_URL`, or `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN`, or `INFURA_KEY`. |
| `Missing PRIVATE_KEYS (comma-separated).` | `PRIVATE_KEYS` unset or empty. | Add at least one deployer key to `PRIVATE_KEYS` (comma-separated). |
| `Invalid number of parameters for "constructor"` | Constructor args in `migrations/2_deploy_contracts.js` don’t match the target deployment. | Update the migration parameters (token, ENS, NameWrapper, root nodes, Merkle roots) before deploying. |
| `Returned error: insufficient funds` | Deployer account lacks ETH on target network. | Fund the deployer account and retry. |
| Verification fails with mismatched bytecode | Compiler settings don’t match deployment. | Ensure `SOLC_VERSION`, `SOLC_RUNS`, `SOLC_VIA_IR`, and `SOLC_EVM_VERSION` match the deployment configuration. |
| `nonce too low` or `replacement transaction underpriced` | Parallel deploys with the same key or stale nonce. | Run one deployment at a time or reset the nonce in your wallet/provider. |
