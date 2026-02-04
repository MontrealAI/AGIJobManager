# Deployment guide (Truffle)

This guide documents the deployment and verification workflow defined in `truffle-config.js` and the migration scripts in `migrations/`.

## Prerequisites
- Node.js + npm.
- Truffle (installed via `npm install`).
- RPC access for Sepolia or Mainnet (or a local Ganache instance).

## Install & compile

```bash
npm install
npm run build
```

## Networks configured
- **test**: in‑process Ganache provider for `truffle test` (chainId/networkId 1337).
- **development**: local RPC at `127.0.0.1:8545` (Ganache).
- **sepolia**: remote deployment via RPC (HDWalletProvider).
- **mainnet**: remote deployment via RPC (HDWalletProvider).

## Environment variables (Truffle + provider)

`truffle-config.js` supports direct RPC URLs or provider keys. `PRIVATE_KEYS` is required for Sepolia/Mainnet deployments.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PRIVATE_KEYS` | Deployer keys | Comma‑separated, no spaces. Required for Sepolia/Mainnet deployments. |
| `SEPOLIA_RPC_URL` | Sepolia RPC URL | Optional if using Alchemy or Infura. |
| `MAINNET_RPC_URL` | Mainnet RPC URL | Optional if using Alchemy or Infura. |
| `ALCHEMY_KEY` | Alchemy key for Sepolia | Used if `SEPOLIA_RPC_URL` is empty. |
| `ALCHEMY_KEY_MAIN` | Alchemy key for Mainnet | Falls back to `ALCHEMY_KEY` if empty. |
| `INFURA_KEY` | Infura key | Used if no direct RPC URL or Alchemy key. |
| `ETHERSCAN_API_KEY` | Verification key | Used by `truffle-plugin-verify`. |
| `RPC_POLLING_INTERVAL_MS` | Provider polling interval | Defaults to 8000 ms. |
| `SEPOLIA_GAS` / `MAINNET_GAS` | Gas limit override | Defaults to 8,000,000. |
| `SEPOLIA_GAS_PRICE_GWEI` / `MAINNET_GAS_PRICE_GWEI` | Gas price override | In Gwei. |
| `SEPOLIA_CONFIRMATIONS` / `MAINNET_CONFIRMATIONS` | Confirmations to wait | Defaults to 2. |
| `SEPOLIA_TIMEOUT_BLOCKS` / `MAINNET_TIMEOUT_BLOCKS` | Timeout blocks | Defaults to 500. |
| `SOLC_EVM_VERSION` | Override EVM version | Defaults to `london`. |
| `GANACHE_MNEMONIC` | Local test mnemonic | Defaults to Ganache standard mnemonic if unset. |

A template lives in [`.env.example`](../.env.example).

## Environment variables (deployment configuration)

`migrations/2_deploy_contracts.js` reads constructor parameters via `migrations/deploy-config.js`.

**Required (Sepolia / non‑mainnet)**
- `AGI_TOKEN_ADDRESS`
- `AGI_ENS_REGISTRY`
- `AGI_NAMEWRAPPER`
- `AGI_CLUB_ROOT_NODE`
- `AGI_ALPHA_CLUB_ROOT_NODE`
- `AGI_AGENT_ROOT_NODE`
- `AGI_ALPHA_AGENT_ROOT_NODE`

**Optional (all networks)**
- `AGI_BASE_IPFS_URL` (defaults to `https://ipfs.io/ipfs/`)
- `AGI_VALIDATOR_MERKLE_ROOT` (defaults to a fixed zero-like root)
- `AGI_AGENT_MERKLE_ROOT` (defaults to a fixed zero-like root)
- `LOCK_CONFIG` (set to `true` to call `lockConfiguration` post‑deploy)

**Mainnet defaults**
For `mainnet`, `deploy-config.js` includes default addresses for token, ENS, NameWrapper, and root nodes. Validate and override these defaults explicitly for any production deployment.

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

1. Set env vars (`PRIVATE_KEYS` + RPC configuration + deploy config).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network sepolia
   ```

## Mainnet deployment

1. Set env vars (`PRIVATE_KEYS` + RPC configuration + deploy config).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network mainnet
   ```

## Verification (Etherscan)

When `ETHERSCAN_API_KEY` is set:

```bash
npx truffle run verify AGIJobManager --network sepolia
npx truffle run verify AGIJobManager --network mainnet
```

**Verification tips**
- Keep the compiler settings from `truffle-config.js` identical to the original deployment (solc `0.8.19`, runs `50`, `evmVersion` default `london`).
- Ensure constructor parameters match the deployed contract.
- If the plugin fails, re‑run with `--debug` to capture full output.

## Troubleshooting
- **Missing RPC URL**: set `SEPOLIA_RPC_URL` or `MAINNET_RPC_URL`, or provide `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN` / `INFURA_KEY`.
- **Missing private keys**: ensure `PRIVATE_KEYS` is set and comma‑separated.
- **Verification failures**: confirm compiler version and optimizer runs match the deployed bytecode.
- **Nonce conflicts**: avoid running multiple deployment processes with the same keys.
