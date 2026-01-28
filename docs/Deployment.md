# Deployment guide (Truffle)

This guide documents the deployment and verification workflow defined in `truffle-config.js` and the migration scripts in `migrations/`.

## Prerequisites
- Node.js and npm (CI uses Node 20).
- Truffle (installed via `npm install`).
- RPC access for Sepolia or Mainnet.

## Environment variables

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PRIVATE_KEYS` | Deployer keys | Comma-separated, no spaces. |
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
| `SOLC_VERSION` / `SOLC_RUNS` / `SOLC_VIA_IR` / `SOLC_EVM_VERSION` | Compiler settings | Must match deployed bytecode for verification. |
| `GANACHE_MNEMONIC` | Local test mnemonic | Defaults to Ganache standard mnemonic if unset. |

A template lives in [`.env.example`](../.env.example).

## Migration script notes

The deployment script in `migrations/2_deploy_contracts.js` hardcodes constructor parameters (token address, ENS addresses, root nodes, Merkle roots). **Edit these values** before deploying to any production network.

## Local deployment (Ganache)

1. Start Ganache:
   ```bash
   npx ganache -p 8545
   ```
2. Deploy:
   ```bash
   npx truffle migrate --network development
   ```

## Sepolia deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npx truffle migrate --network sepolia
   ```

## Mainnet deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npx truffle migrate --network mainnet
   ```

## Verification (Etherscan)

When `ETHERSCAN_API_KEY` is set:

```bash
npx truffle run verify AGIJobManager --network sepolia
```

## Troubleshooting
- **Missing RPC URL**: set `SEPOLIA_RPC_URL` or `MAINNET_RPC_URL`, or provide `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN` / `INFURA_KEY`.
- **Missing private keys**: ensure `PRIVATE_KEYS` is set and comma-separated.
- **Verification failures**: confirm your compiler version and optimizer settings match the deployed bytecode.
- **Nonce conflicts**: avoid running multiple deployment processes with the same keys.
